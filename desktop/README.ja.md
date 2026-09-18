# Beef Board Configurator — Windowsデスクトップ版

## 起動と設定

GitHub Releaseから最新版のWindows x64用ポータブルEXEを取得し、ダブルクリックします。ブラウザ、Node.js、Pythonの追加インストールは不要です。ポータブルEXEは起動時に内部ファイルを一時フォルダーへ展開します。テーマなどの状態はWindowsユーザーのアプリデータに保存されます。

BEEF BOARDを接続し、アプリ内の「接続 / Connect Device」を押してください。複数台ある場合は機器選択が表示されます。現在のデスクトップ版はIIDX向けで、Default / IIDX Entry / IIDX Premium、Joystick / Keyboard入力、ターンテーブル、LED、キー割り当て、コントローラーモニターを統合しています。設定変更は基板へ送信され、対応項目はEEPROMへ保存されます。

## ファームウェア更新

Firmwareタブは基板に接続する前から開けます。①BEEF BOARD用のHEXファイルを選択、②通常接続なら「接続中の基板を書き込みモードにする」を押し、数秒後に「書き込みモードの機器に接続」、③「書き込み開始」→確認画面の「このファイルを書き込む」の順で進めます。すでにDFUモードの場合は直接接続してください。完了後は「通常モードで再起動」を押します。ファイル名・データサイズ・進捗を表示し、不正なHEXは拒否します。対応するBEEF BOARD用HEXを選択して書き込みます。本リポジトリにはConfiguratorと対応するファームウェアソースも含まれています。

通常設定はWindowsの標準HIDを使用します。更新時のAT90USB1286 DFU（VID:PID = 03EB:2FFB）はWebUSB用のWinUSBドライバーが必要です。認識されない場合は[Zadig](https://zadig.akeo.ie/)でDFU機器のIDを確認してください。通常動作中のBEEF BOARD HIDや他の機器のドライバーを変更しないでください。リポジトリの旧beef-tool用ドライバー一括導入はこのアプリでは実行しません。

書き込み中は切断しないでください。元実装に上位フラッシュページの選択処理がないため、この版は64 KiB以上のアドレスを含むHEXを拒否します。これは128 KiB MCU全領域への対応を意味しません。DFU書き込み時は対象機器とHEXファイルを確認し、書き込み中にUSBを切断しないでください。

## 調査した構成

調査対象: https://github.com/HWXLR8/beef-board

取得コミット: `4bca27fa8e2638e9ad5beb180c95ac12b5567c8f`

|場所|内容・依存関係|
|---|---|
|beef-config|Svelte 5、SvelteKit 2、TypeScript、Vite 6、Tailwind 4、静的サイト出力。元CIはNode 22でnpm installとnpm run buildを実行|
|src/lib/types/hid.ts|WebHID。VID 1CCF、PID 8048/101C、Usage Page FFEB、Usage 01、製品名BEEF BOARDを対象。Feature Report 1=設定、2=コマンド、3=バージョン|
|src/lib/types/dfu.ts|WebUSBによるAtmel DFU。03EB:2FFB、interface 0。Intel HEX解析にnrf-intel-hex|
|fw|AT90USB1286、16 MHz、C/C++、AVR GCC、make、LUFA、FastLEDサブモジュール。元CIはAVR GCC 15.2.0でbeef.hexを作成|
|beef-tool|Python製の旧ファームウェア更新GUI、avrdude、旧ドライバー。同CIでPyInstallerのonefile/noconsoleを使用。設定GUIとは別物|
|pcb / remote-board / tt-adapter|基板・関連ハードウェア資料|
|spiceapi|SpiceTools連携用補助スクリプト。今回のGUIには統合していない|

現在のConfiguratorで選択できるコントローラーモードはDefault / IIDX Entry / IIDX Premiumです。旧実装由来の互換用データ構造が残る場合がありますが、現行UIではSDVXモードを提供していません。

## デスクトップ化方針と変更

Electron 44.3.0 + electron-builder 26.15.3を採用。既存WebHID/WebUSBとUIをそのまま活かせることを優先しました。Tauri/WebView2方式は同じ通信APIをそのまま維持する前提に向かず、ネイティブUSB連携の再実装が増えるため採用していません。

同梱した静的画面を内部の https://beef.local へ割り当てます。外部サーバーや待受ポートは使いません。Chromiumを同梱するためEXEは大きくなります。画面側のNode.jsを無効化し、サンドボックスとコンテキスト分離を有効にしています。機器ID・名前とアプリのオリジンを照合してHID/USBを許可します。外部ページをアプリ内で開くことは防止し、指定のヘルプリンクは既定ブラウザに渡します。

追加修正: BASE_PATH省略時のビルド、切断済み機器のcloseエラー処理、設定送信の非同期エラー表示、不正HEXの表示と古い選択データの破棄、書き込み失敗後の状態復帰、HEXの疎なアドレス保持、DFU進捗の分母、対応外アドレスの消去前チェック。

## 再ビルド

ソースZIPを展開し、Node.jsとnpmを用意して実行してください。今回のビルド環境はWindows x64、Node 24.12.0、npm 11.6.2です。

```powershell
cd beef-config
npm ci
npm run check
cd ../desktop
npm ci
node --test policy.test.cjs firmware.test.cjs
npm run dist
node smoke.cjs
```

出力先はdesktop/package.jsonのbuild.directories.output（相対パス `../../../outputs/build`）で変更できます。smoke.cjsはElectronの実ウィンドウと模擬HIDを使用する検査で、実機書き込みを行いません。

## 検証と制限

V1.00ではSvelte/TypeScriptチェック、UIロジックテスト、Desktop単体テスト、Windows portable EXEビルド、ファームウェアのホストテストとAVR-GCCビルドを実施しています。

依存パッケージは互換範囲で更新し、Configurator側・Electron/Desktop側ともにnpm auditで既知の脆弱性0件を確認しています。

EXEはコード署名なしです。環境やUSBドライバー構成によって機器認識が異なる場合があります。

## ライセンス・参考

元リポジトリはGPL-3.0。変更ソースとLICENSEを同梱しています。配布時も対応ソースを提供してください。FastLEDサブモジュールはソースZIPに実体を含めず、ファームウェアを再ビルドする場合は元リポジトリでsubmoduleを取得してください。

- [元リポジトリ](https://github.com/HWXLR8/beef-board)
- [ElectronのHID/USB対応](https://www.electronjs.org/docs/latest/tutorial/devices)
- [Electron Session API](https://www.electronjs.org/docs/latest/api/session)

