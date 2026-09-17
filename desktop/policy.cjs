const ORIGIN = 'https://beef.local';
function trusted(url) {
  try { return new URL(url).origin === ORIGIN; } catch { return false; }
}
function allowedDevice(type, device) {
  if (!device) return false;
  if (type === 'hid') return (
    (device.vendorId === 0xfeed && device.productId === 0x0000) ||
    (device.vendorId === 0x1ccf && [0x1018, 0x8048].includes(device.productId))
  ) && (device.name ?? device.productName) === 'BEEF BOARD';
  return type === 'usb' && device.vendorId === 0x03eb && device.productId === 0x2ffb;
}
module.exports = { ORIGIN, trusted, allowedDevice };
