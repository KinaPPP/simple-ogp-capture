// background.js — シンプルOGPキャプチャ v1.1.0

const TARGET_W = 1200;
const TARGET_H = 630;

// クロップ確定待ちのPromise resolver
let pendingCropResolve = null;
let pendingCropReject  = null;

// ─── メッセージハンドラ ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'CAPTURE') {
    handleCapture(msg.mode)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ error: e.message }));
    return true; // async
  }

  if (msg.type === 'CANVAS_RESULT') {
    // offscreen.js からの結果 — processWithOffscreen() の内部リスナーが処理
    return false;
  }

  if (msg.type === 'CROP_CAPTURE') {
    if (pendingCropResolve) { pendingCropResolve(msg); pendingCropResolve = pendingCropReject = null; }
    return false;
  }

  if (msg.type === 'CROP_CANCELLED') {
    if (pendingCropReject) { pendingCropReject(new Error('キャンセルされました')); pendingCropResolve = pendingCropReject = null; }
    return false;
  }
});

// ─── エントリポイント ──────────────────────────────────────────────
async function handleCapture(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('タブが見つかりません');

  const url = tab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    throw new Error('このページはキャプチャできません');
  }

  if (mode === 'crop') {
    await captureCrop(tab);
  } else {
    await captureResize(tab);
  }
}

// ─── リサイズモード ────────────────────────────────────────────────
// タブを別ウィンドウに切り離し → 1200×630にリサイズ → 撮影 → 元に戻す
async function captureResize(tab) {
  const originalWindowId = tab.windowId;
  const originalIndex    = tab.index;

  // ① 現在のビューポートサイズを取得してブラウザUIのオフセットを計算
  const [win, viewportSize] = await Promise.all([
    chrome.windows.get(originalWindowId),
    getViewportSize(tab.id)
  ]);
  const chromeOffsetW = win.width  - viewportSize.w;
  const chromeOffsetH = win.height - viewportSize.h;

  // ② タブを新しいウィンドウへ切り離す（目標サイズで作成）
  const newWin = await chrome.windows.create({
    tabId:  tab.id,
    type:   'normal',
    width:  TARGET_W + chromeOffsetW,
    height: TARGET_H + chromeOffsetH,
    state:  'normal',
    focused: true
  });

  await sleep(600);

  // ③ 実際のビューポートを確認して微調整
  const actualVp = await getViewportSize(tab.id);
  if (actualVp.w !== TARGET_W || actualVp.h !== TARGET_H) {
    const diffW = TARGET_W - actualVp.w;
    const diffH = TARGET_H - actualVp.h;
    await chrome.windows.update(newWin.id, {
      width:  TARGET_W + chromeOffsetW + diffW,
      height: TARGET_H + chromeOffsetH + diffH
    });
    await sleep(400);
  }

  // ④ スクロールをトップへ
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.scrollTo(0, 0)
  });
  await sleep(120);

  // ⑤ キャプチャ
  const dataUrl = await chrome.tabs.captureVisibleTab(newWin.id, { format: 'png' });

  // ⑥ Canvas でクロップ/リサイズ
  const processedUrl = await processWithOffscreen(dataUrl, { mode: 'fit' });

  // ⑦ 元のウィンドウへ戻す
  await reattachTab(tab.id, originalWindowId, originalIndex, newWin.id);

  // ⑧ ダウンロード
  await downloadCapture(processedUrl);
}

// ─── クロップモード ────────────────────────────────────────────────
// タブを別ウィンドウに切り離す → オーバーレイ枠を表示 → ユーザーが範囲確定 → 切り抜いて保存
async function captureCrop(tab) {
  // クロップモードはウィンドウサイズ変更不要 → タブ切り離しなしでそのまま操作

  // クロップ枠オーバーレイを注入
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  // ユーザーの操作（「ここをキャプチャ」クリック）を待つ
  let cropData;
  try {
    cropData = await waitForCropCapture();
  } catch (e) {
    return; // キャンセル
  }

  // content.js 側でブロッカーが挿入済み・オーバーレイ削除済み
  // ブロッカーの 280ms が明けるのを待ってからキャプチャ
  await sleep(320);

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const processedUrl = await processWithOffscreen(dataUrl, {
    mode: 'crop',
    x:   cropData.x,
    y:   cropData.y,
    dpr: cropData.dpr
  });

  await downloadCapture(processedUrl);
}

// ─── ユーティリティ ────────────────────────────────────────────────
function waitForCropCapture() {
  return new Promise((resolve, reject) => {
    pendingCropResolve = resolve;
    pendingCropReject  = reject;
  });
}

async function getViewportSize(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({ w: window.innerWidth, h: window.innerHeight })
  });
  return result;
}

async function reattachTab(tabId, originalWindowId, originalIndex, tempWindowId) {
  try {
    await chrome.windows.get(originalWindowId); // 存在確認
    await chrome.tabs.move(tabId, { windowId: originalWindowId, index: originalIndex });
    try { await chrome.windows.remove(tempWindowId); } catch (_) { /* 既に閉じている */ }
  } catch (_) {
    // 元ウィンドウが閉じていた場合はそのまま（タブは新ウィンドウに残る）
    console.log('[OGP Capture] 元のウィンドウが閉じられています');
  }
}

async function downloadCapture(dataUrl) {
  const ts = formatTimestamp(new Date());
  await chrome.downloads.download({
    url: dataUrl,
    filename: `ogp_capture_${ts}.png`,
    saveAs: false
  });
}

async function processWithOffscreen(dataUrl, options) {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Canvas で画像をクロップ・リサイズ'
    });
  }

  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      if (msg.type === 'CANVAS_RESULT') {
        chrome.runtime.onMessage.removeListener(handler);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.dataUrl);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    chrome.runtime.sendMessage({
      type: 'PROCESS_IMAGE',
      dataUrl,
      targetW: TARGET_W,
      targetH: TARGET_H,
      options
    });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatTimestamp(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
