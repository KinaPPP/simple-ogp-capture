// popup.js — シンプルOGPキャプチャ v1.1.0

const HINTS = {
  resize: 'タブを別ウィンドウに切り離し、1200×630にリサイズして撮影。撮影後に元のウィンドウへ戻します。',
  crop:   'ページはそのままのサイズで表示し、1200×630の枠をドラッグして切り取り範囲を指定します。'
};

let currentMode = 'resize';

async function init() {
  const { captureMode } = await chrome.storage.local.get('captureMode');
  currentMode = captureMode || 'resize';
  updateUI();
}

function updateUI() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });
  document.getElementById('hint-text').textContent = HINTS[currentMode];
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    currentMode = btn.dataset.mode;
    await chrome.storage.local.set({ captureMode: currentMode });
    updateUI();
  });
});

document.getElementById('btn-capture').addEventListener('click', async () => {
  const captureBtn = document.getElementById('btn-capture');
  const statusEl  = document.getElementById('status-text');

  captureBtn.disabled = true;
  captureBtn.textContent = '処理中…';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE', mode: currentMode });
    if (response && response.error) {
      statusEl.textContent = '⚠ ' + response.error;
      captureBtn.disabled = false;
      captureBtn.textContent = '📷 キャプチャ';
      return;
    }
  } catch (e) {
    console.error(e);
  }

  // クロップモードは枠表示後にポップアップを閉じる
  // リサイズモードも閉じる
  window.close();
});

init();
