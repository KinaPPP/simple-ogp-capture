// offscreen.js — Canvas 画像処理 v1.1.0
// fit  モード: アスペクト比維持で中央クロップ → 1200×630
// crop モード: 指定座標(x,y) から 1200×630 を切り抜き (DPR 対応)

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'PROCESS_IMAGE') return;

  const { dataUrl, targetW, targetH, options } = msg;

  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width  = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    if (options?.mode === 'crop') {
      // ── クロップモード ─────────────────────────────────────
      // content.js から受け取った CSS px 座標は DPR 倍済み
      const { x, y, dpr } = options;
      const srcW = targetW * dpr;
      const srcH = targetH * dpr;
      ctx.drawImage(img, x, y, srcW, srcH, 0, 0, targetW, targetH);

    } else {
      // ── フィットモード（中央クロップ） ─────────────────────
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const srcAspect = srcW / srcH;
      const tgtAspect = targetW / targetH;

      let sx, sy, sw, sh;
      if (Math.abs(srcAspect - tgtAspect) < 0.01) {
        sx = 0; sy = 0; sw = srcW; sh = srcH;
      } else if (srcAspect > tgtAspect) {
        sh = srcH; sw = sh * tgtAspect;
        sx = (srcW - sw) / 2; sy = 0;
      } else {
        sw = srcW; sh = sw / tgtAspect;
        sx = 0; sy = (srcH - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
    }

    chrome.runtime.sendMessage({
      type: 'CANVAS_RESULT',
      dataUrl: canvas.toDataURL('image/png')
    });
  };

  img.onerror = () => {
    chrome.runtime.sendMessage({
      type: 'CANVAS_RESULT',
      error: '画像の読み込みに失敗しました'
    });
  };

  img.src = dataUrl;
});
