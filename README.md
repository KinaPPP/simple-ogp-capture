# シンプルOGPキャプチャ / Simple OGP Capture

OGP推奨サイズ（1200×630px）でタブをキャプチャするChrome拡張 / Chrome extension to capture tabs at OGP recommended size (1200×630px)

## 機能 / Features

- **リサイズモード** — タブを別ウィンドウに切り離し、1200×630にリサイズして撮影。撮影後に元のウィンドウへ戻します。
- **クロップモード** — ページはそのままのサイズで表示し、1200×630の枠をドラッグして切り取り範囲を指定します。

---

- **Resize mode** — Detaches the tab into a new window, resizes to 1200×630, captures, then returns it to the original window.
- **Crop mode** — Keeps the page at its natural size and lets you drag a 1200×630 frame to select the capture area.

## インストール / Installation

1. `chrome://extensions` を開く / Open `chrome://extensions`
2. デベロッパーモードをオン / Enable Developer mode
3. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択 / Click "Load unpacked" and select this folder

## 使い方 / Usage

1. 拡張機能アイコンをクリックしてポップアップを開く / Click the extension icon to open the popup
2. モードを選択（リサイズ / クロップ）/ Select a mode (Resize / Crop)
3. 「📷 キャプチャ」ボタンをクリック / Click the "📷 キャプチャ" button
4. クロップモードの場合は枠をドラッグして位置を決め、「📷 ここをキャプチャ」をクリック / In crop mode, drag the frame to position it, then click "📷 ここをキャプチャ"
5. `ogp_capture_YYYYMMDD_HHMMSS.png` としてダウンロードされます / The file is saved as `ogp_capture_YYYYMMDD_HHMMSS.png`

## Author

KINA
