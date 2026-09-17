const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const executablePath = process.env.BEEF_TEST_EXE;
  const testData = path.join(__dirname, '../../../work/test-user-data');
  const app = await electron.launch(executablePath ? { executablePath, args: [], env: { ...process.env, BEEF_TEST_USER_DATA: testData } } : { args: [__dirname], env: { ...process.env, BEEF_TEST_USER_DATA: testData } });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.getByRole('button', { name: '接続 / Connect Device' }).waitFor();
    await page.getByRole('button', { name: '日本語', exact: true }).click();
    await page.getByRole('option', { name: 'English', exact: true }).click();
    await page.getByRole('tab', { name: 'Config', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('beef-language')), 'en');
    const selected = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const ses = win.webContents.session;
      const run = type => new Promise(resolve => ses.emit(`select-${type}-device`, { preventDefault() {} },
        { frame: win.webContents.mainFrame, deviceList: type === 'hid' ? [{ deviceId: 'mock-hid', vendorId: 0x1ccf, productId: 0x8048, name: 'BEEF BOARD' }]
          : [{ deviceId: 'mock-usb', vendorId: 0x03eb, productId: 0x2ffb, productName: 'AT90USB1286' }] }, resolve));
      return [await run('hid'), await run('usb')];
    });
    assert.deepEqual(selected, ['mock-hid', 'mock-usb']);
    assert.deepEqual(await page.evaluate(() => ({ hid: !!navigator.hid, usb: !!navigator.usb, secure: isSecureContext, node: typeof window.require })),
      { hid: true, usb: true, secure: true, node: 'undefined' });
    await page.screenshot({ path: path.join(__dirname, '../../../outputs/start-screen.png') });
    await page.evaluate(() => {
      const packet = new Uint8Array(1025); packet[0] = 1; packet[1] = 20; packet[5] = 1; packet[31] = 4; packet[81] = 16;
      window.testWrites = [];
      const device = { productName: 'BEEF BOARD', opened: true, close: async () => {},
        vendorId: 0x1ccf, productId: 0x8048,
        receiveFeatureReport: async id => id === 3 ? new DataView(new Uint8Array([3, 0x78, 0x56, 0x34, 0x12]).buffer) : new DataView(packet.buffer),
        sendFeatureReport: async (id, data) => { window.testWrites.push({ id, data: [...data] }); } };
      Object.defineProperty(navigator.hid, 'requestDevice', { configurable: true, value: async () => [device] });
      Object.defineProperty(navigator.hid, 'getDevices', { configurable: true, value: async () => [device] });
    });
    await page.getByRole('button', { name: '接続 / Connect Device' }).click();
    await page.getByText('IIDX Configuration', { exact: true }).waitFor();
    const toggle = page.getByRole('switch').first();
    await toggle.click();
    await page.waitForFunction(() => window.testWrites.some(x => x.id === 1 && x.data[1] === 1));
    await page.screenshot({ path: path.join(__dirname, '../../../outputs/config-screen.png'), fullPage: true });
    await page.getByRole('tab', { name: 'Firmware', exact: true }).click();
    await page.getByText('0x12345678').waitFor();
    await page.getByRole('tab', { name: 'Config', exact: true }).click();
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await page.getByRole('option', { name: 'IIDX Entry', exact: true }).click();
    await page.getByText('IIDX Configuration', { exact: true }).waitFor();
    await page.waitForFunction(() => window.testWrites.some(x => x.id === 1 && x.data[31] === 1));
    await page.waitForFunction(() => window.testWrites.some(x => x.id === 2 && x.data[0] === 3));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: packaged origin, WebHID/WebUSB, isolation, three IIDX identity modes, feature-report write, firmware hash; mock HID only');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
