const { app, BrowserWindow, session, dialog, shell, net, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { ORIGIN, trusted, allowedDevice } = require('./policy.cjs');
const { createFlasher } = require('./native-flash.cjs');
const { checkForUpdate } = require('./update-check.cjs');

let window;
if (process.env.BEEF_TEST_USER_DATA) app.setPath('userData', process.env.BEEF_TEST_USER_DATA);
const hasInstanceLock = process.env.BEEF_TEST_USER_DATA ? true : app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
else {
  app.on('second-instance', () => { if (window) { window.restore(); window.focus(); } });
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('起動エラー', String(error));
    app.quit();
  });
}
app.on('window-all-closed', () => app.quit());

function formatDisplayVersion(version) {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(version).trim());
  if (!match) return String(version);
  const [, major, minor, patch = '0'] = match;
  const base = `V${major}.${minor.padStart(2, '0')}`;
  return Number(patch) === 0 ? base : `${base}.${Number(patch)}`;
}

async function start() {
  const flasher = createFlasher(app.isPackaged ? path.join(process.resourcesPath, 'avrdude') : path.join(__dirname, '../beef-tool/avrdude'));
  const authorize = event => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || !trusted(event.senderFrame.url)) throw new Error('Unauthorized');
  };
  ipcMain.handle('beef:select-firmware', async event => {
    authorize(event);
    if (flasher.busy) throw new Error('書き込み中です。');
    const result = await dialog.showOpenDialog(window, { title: 'BEEF BOARD用ファームウェアを選択', properties: ['openFile'], filters: [{ name: 'Intel HEX', extensions: ['hex'] }] });
    return flasher.select(result.canceled ? null : result.filePaths[0]);
  });
  ipcMain.handle('beef:flash-firmware', async event => {
    authorize(event);
    return flasher.flash(text => { if (!window.webContents.isDestroyed()) window.webContents.send('beef:flash-log', text); });
  });
  ipcMain.handle('beef:get-version', async event => {
    authorize(event);
    return app.getVersion();
  });
  ipcMain.handle('beef:check-update', async event => {
    authorize(event);
    try {
      return await checkForUpdate((url, options) => net.fetch(url, options), app.getVersion());
    } catch (error) {
      console.warn('Update check failed:', error);
      return null;
    }
  });
  ipcMain.handle('beef:open-update', async (event, url) => {
    authorize(event);
    if (typeof url !== 'string' || !url.startsWith('https://github.com/okapi2dx/Beef-Board-Configurator/')) throw new Error('Invalid update URL');
    await shell.openExternal(url);
  });
  const ses = session.fromPartition('persist:beef-board');
  const root = app.isPackaged ? path.join(__dirname, 'ui') : path.join(__dirname, '../beef-config/build');
  // A local HTTPS origin preserves WebHID/WebUSB without opening a listening port.
  await ses.protocol.handle('https', request => {
    if (!trusted(request.url)) return new Response('Forbidden', { status: 403 });
    let name;
    try { name = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response('Bad request', { status: 400 }); }
    const file = path.resolve(root, '.' + name);
    if (file !== root && !file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    const target = name === '/' ? path.join(root, fs.existsSync(path.join(root, 'index.html')) ? 'index.html' : '404.html') : file;
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(target).href);
  });
  ses.setPermissionCheckHandler((contents, permission, origin) =>
    contents === window?.webContents && trusted(origin) && ['hid', 'usb'].includes(permission));
  ses.setPermissionRequestHandler((contents, permission, callback) =>
    callback(contents === window?.webContents && trusted(contents.getURL()) && ['hid', 'usb'].includes(permission)));
  ses.setDevicePermissionHandler(details => trusted(details.origin) && allowedDevice(details.deviceType, details.device));
  for (const type of ['hid', 'usb']) {
    ses.on(`select-${type}-device`, async (event, details, callback) => {
      event.preventDefault();
      if (!trusted(details.frame?.url)) return callback('');
      const devices = details.deviceList.filter(device => allowedDevice(type, device));
      if (!devices.length) {
        callback('');
        await dialog.showMessageBox(window, { type: 'info', title: '機器が見つかりません',
          message: type === 'hid' ? 'BEEF BOARDをUSBで接続して、もう一度お試しください。' : 'DFU機器が見つかりません。起動モードとWinUSBドライバーを確認して、再接続してください。' });
        return;
      }
      if (devices.length === 1) return callback(devices[0].deviceId);
      try {
        const result = await dialog.showMessageBox(window, { title: '接続する機器', message: 'BEEF BOARDを選択してください。',
          buttons: [...devices.map((d, i) => `${i + 1}: ${d.name || d.productName || 'AT90USB1286 DFU'} ${d.serialNumber || ''}`), 'キャンセル'],
          cancelId: devices.length, defaultId: 0 });
        callback(devices[result.response]?.deviceId || '');
      } catch { callback(''); }
    });
  }
  window = new BrowserWindow({ width: 980, height: 740, minWidth: 720, minHeight: 560,
    title: `Beef Board Configurator ${formatDisplayVersion(app.getVersion())}`, autoHideMenuBar: true,
    webPreferences: { session: ses, preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  window.on('close', event => { if (flasher.busy) event.preventDefault(); });
  app.on('before-quit', event => { if (flasher.busy) event.preventDefault(); });
  window.removeMenu();
  const external = url => { if (url.startsWith('https://github.com/') || url.startsWith('https://zadig.akeo.ie/')) void shell.openExternal(url); };
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) { event.preventDefault(); external(url); } });
  window.webContents.on('will-prevent-unload', () => {
    // Honor the firmware screen's close guard; never force-close a flashing session.
    void dialog.showMessageBox(window, { type: 'warning', message: '書き込み中です。完了するまでアプリを閉じないでください。' });
  });
  await window.loadURL(ORIGIN + '/');
}
