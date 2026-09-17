const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createFlasher, validateHex } = require('./native-flash.cjs');
const good = ':0400000001020304F2\n:00000001FF\n';
test('HEX rejects corrupt/empty/trailing data and accepts AVR upper addresses', () => {
  assert.equal(validateHex(good), 4);
  for (const text of ['', ':00000001FF', good.replace('F2', 'F1'), good + good]) assert.throws(() => validateHex(text));
  assert.equal(validateHex(':020000040001F9\n' + good), 4);
  assert.throws(() => validateHex(':020000040002F8\n' + good));
});
test('native writer uses a validated snapshot, fixed args, verifies by default, locks concurrent writes and cleans up', async () => {
  const folder = await fs.mkdtemp(path.join(__dirname, 'test-flash-'));
  const filename = path.join(folder, '日本語 file.hex');
  let command, args, options, child;
  const flasher = createFlasher('C:/tools', (exe, argv, opts) => {
    command = exe; args = argv; options = opts;
    child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); return child;
  });
  try {
    await fs.writeFile(filename, good);
    assert.equal((await flasher.select(filename)).bytes, 4);
    await fs.writeFile(filename, 'invalid after selection');
    const result = flasher.flash(() => {});
    await assert.rejects(flasher.flash(() => {}));
    while (!child) await new Promise(r => setTimeout(r, 5));
    assert.equal(await fs.readFile(path.join(options.cwd, 'firmware.hex'), 'utf8'), good);
    assert.equal(path.basename(command), 'avrdude.exe');
    assert.deepEqual(args.slice(-6), ['-c', 'flip1', '-p', 'usb1286', '-U', 'flash:w:firmware.hex:i']);
    assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
    assert.equal(args.includes('-V'), false); assert.equal(args.includes('-F'), false);
    child.emit('close', 1);
    assert.deepEqual(await result, { success: false, exitCode: 1 });
    assert.equal(flasher.busy, false);
    await assert.rejects(fs.stat(options.cwd));
    await flasher.select(null);
    await assert.rejects(flasher.flash(() => {}));
  } finally { await fs.unlink(filename); await fs.rmdir(folder); }
});
