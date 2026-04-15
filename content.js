// content.js — OGPクロップオーバーレイ v1.1.3
// chrome.scripting.executeScript で注入される

(function () {
  'use strict';

  if (document.getElementById('__ogp_crop_overlay__')) return;

  const TARGET_W = 1200;
  const TARGET_H = 630;
  const DPR = window.devicePixelRatio || 1;

  let frameX = Math.max(0, Math.floor((window.innerWidth  - TARGET_W) / 2));
  let frameY = Math.max(0, Math.floor((window.innerHeight - TARGET_H) / 2));

  let dragging = false;
  let dragStartX = 0, dragStartY = 0;
  let dragFrameX = 0, dragFrameY = 0;

  // ─── DOM 構築 ──────────────────────────────────────────────────

  const root = document.createElement('div');
  root.id = '__ogp_crop_overlay__';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:"Segoe UI","Yu Gothic UI",sans-serif;';

  // 暗幕 4 枚（枠の外側のクリックをブロック）
  const dimStyle = 'position:fixed;background:rgba(0,0,0,0.52);pointer-events:auto;z-index:2147483646;cursor:default;';
  const dimTop    = makeDim();
  const dimBottom = makeDim();
  const dimLeft   = makeDim();
  const dimRight  = makeDim();

  // キャプチャ枠
  const frame = document.createElement('div');
  frame.style.cssText = [
    'position:fixed', 'box-sizing:border-box',
    'border:2px solid #4a7fc1',
    'outline:1px solid rgba(255,255,255,0.35)',
    'cursor:move',
    'pointer-events:auto',
    'background:rgba(0,0,0,0.01)',
    'z-index:2147483647'
  ].join(';');

  // ── 中央パネル（キャプチャ・キャンセルボタン）
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute', 'top:50%', 'left:50%',
    'transform:translate(-50%,-50%)',
    'display:flex', 'flex-direction:column', 'align-items:center', 'gap:10px',
    'pointer-events:auto',
    'opacity:1',
    'transition:opacity 0.18s ease',
    'z-index:1'
  ].join(';');

  const captureBtn = document.createElement('button');
  captureBtn.style.cssText = [
    'padding:11px 28px', 'font-size:14px', 'font-weight:bold',
    'background:#4a7fc1', 'color:#fff',
    'border:none', 'border-radius:8px', 'cursor:pointer',
    'box-shadow:0 3px 12px rgba(0,0,0,0.35)',
    'white-space:nowrap',
    'transition:background 0.1s'
  ].join(';');
  captureBtn.textContent = '📷 ここをキャプチャ';
  captureBtn.onmouseenter = () => { captureBtn.style.background = '#3d6ea8'; };
  captureBtn.onmouseleave = () => { captureBtn.style.background = '#4a7fc1'; };

  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = [
    'padding:5px 16px', 'font-size:11px',
    'background:rgba(0,0,0,0.45)', 'color:rgba(255,255,255,0.8)',
    'border:1px solid rgba(255,255,255,0.25)', 'border-radius:5px', 'cursor:pointer',
    'white-space:nowrap'
  ].join(';');
  cancelBtn.textContent = 'キャンセル';

  // ドラッグヒント（ドラッグ中のみ表示）
  const dragHint = document.createElement('div');
  dragHint.style.cssText = [
    'position:absolute', 'top:50%', 'left:50%',
    'transform:translate(-50%,-50%)',
    'color:rgba(255,255,255,0.35)', 'font-size:12px',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 0.18s ease',
    'white-space:nowrap'
  ].join(';');
  dragHint.textContent = '移動中…';

  // サイズバッジ（右下）
  const badge = document.createElement('div');
  badge.style.cssText = [
    'position:absolute', 'bottom:6px', 'right:8px',
    'font-size:10px', 'color:rgba(255,255,255,0.45)',
    'pointer-events:none'
  ].join(';');
  badge.textContent = `${TARGET_W} × ${TARGET_H}`;

  panel.append(captureBtn, cancelBtn);
  frame.append(panel, dragHint, badge);
  root.append(dimTop, dimBottom, dimLeft, dimRight, frame);
  document.body.appendChild(root);

  updatePositions();

  // ─── ドラッグ ──────────────────────────────────────────────────
  frame.addEventListener('mousedown', (e) => {
    if (e.target === captureBtn || e.target === cancelBtn) return;
    dragging   = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragFrameX = frameX;
    dragFrameY = frameY;
    e.preventDefault();

    // ドラッグ中：中央パネルを隠してドラッグヒントを出す
    panel.style.opacity    = '0';
    panel.style.pointerEvents = 'none';
    dragHint.style.opacity = '1';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    frameX = Math.max(0, Math.min(window.innerWidth  - TARGET_W, dragFrameX + (e.clientX - dragStartX)));
    frameY = Math.max(0, Math.min(window.innerHeight - TARGET_H, dragFrameY + (e.clientY - dragStartY)));
    updatePositions();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;

    // ドラッグ終了：中央パネルを再表示
    panel.style.opacity    = '1';
    panel.style.pointerEvents = 'auto';
    dragHint.style.opacity = '0';
  });

  // ─── ボタンアクション ─────────────────────────────────────────
  captureBtn.addEventListener('click', () => {
    const snapX = Math.round(frameX * DPR);
    const snapY = Math.round(frameY * DPR);

    // オーバーレイを消す前に全画面クリックブロッカーを挟む
    // → captureBtn クリックの mouseup がゲームに届くのを防ぐ
    const blocker = document.createElement('div');
    blocker.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:auto;cursor:wait;';
    document.body.appendChild(blocker);

    root.remove();

    setTimeout(() => {
      blocker.remove();
      chrome.runtime.sendMessage({ type: 'CROP_CAPTURE', x: snapX, y: snapY, dpr: DPR });
    }, 280);
  });

  cancelBtn.addEventListener('click', () => {
    root.remove();
    chrome.runtime.sendMessage({ type: 'CROP_CANCELLED' });
  });

  // ─── 位置更新 ──────────────────────────────────────────────────
  function updatePositions() {
    const x2 = frameX + TARGET_W;
    const y2 = frameY + TARGET_H;

    frame.style.left   = frameX + 'px';
    frame.style.top    = frameY + 'px';
    frame.style.width  = TARGET_W + 'px';
    frame.style.height = TARGET_H + 'px';

    setDim(dimTop,    0,       0,          '100%',                    frameY + 'px');
    setDim(dimBottom, y2,      0,          '100%',                    `calc(100vh - ${y2}px)`);
    setDim(dimLeft,   frameY,  0,          frameX + 'px',             TARGET_H + 'px');
    setDim(dimRight,  frameY,  x2 + 'px', `calc(100vw - ${x2}px)`,   TARGET_H + 'px');
  }

  function setDim(d, top, left, width, height) {
    d.style.top    = (typeof top  === 'number' ? top  + 'px' : top);
    d.style.left   = (typeof left === 'number' ? left + 'px' : left);
    d.style.width  = width;
    d.style.height = height;
  }

  function makeDim() {
    const d = document.createElement('div');
    d.style.cssText = dimStyle;
    return d;
  }
})();
