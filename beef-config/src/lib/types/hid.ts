import { appState, onDisconnect, connectDevice } from '$lib/types/state.svelte';

export enum ReportId {
  Config = 1,
  Command = 2,
  FirmwareVersion = 3,
  Diagnostics = 4,
  DiagnosticsStream = 5
}

export enum Command {
  Bootloader = 1,
  ResetConfig = 2,
  Restart = 3
}

export type Diagnostics = {
  buttons: number;
  sensorAB: number;
  raw: number;
  filtered: number;
  output: number;
  direction: number;
  transitions: number;
  intervalMs: number;
  ledLevels: number[];
};

export function parseDiagnostics(data: DataView): Diagnostics {
  return {
    buttons: data.getUint16(0, true), sensorAB: data.getUint8(2), raw: data.getUint8(3),
    filtered: data.getUint8(4), output: data.getUint8(5), direction: data.getInt8(6),
    transitions: data.getUint32(7, true), intervalMs: data.getUint16(11, true),
    // v30+ appends the 11 PWM output levels. Keep older diagnostics packets
    // readable so the monitor can still connect before a firmware update.
    ledLevels: data.byteLength >= 24 ? Array.from({ length: 11 }, (_, i) => data.getUint8(13 + i)) : Array(11).fill(0),
  };
}

export async function readDiagnostics(): Promise<Diagnostics> {
  if (!appState.device) throw new Error('Device not connected');
  const result = await appState.device.receiveFeatureReport(ReportId.Diagnostics);
  const data = new DataView(result.buffer, result.byteOffset + 1, result.byteLength - 1);
  return parseDiagnostics(data);
}

const entryProductNames = new Set(['BEEF BOARD', 'beatmania IIDX controller entry model']);
const premiumProductNames = new Set(['BEEF BOARD', 'beatmania IIDX controller premium model']);
const beefHidFilters: HIDDeviceFilter[] = [
  { vendorId: 0xfeed, productId: 0x0000, usagePage: 0xffeb, usage: 0x01 }, // Default
  { vendorId: 0x1ccf, productId: 0x1018, usagePage: 0xffeb, usage: 0x01 }, // IIDX Entry
  { vendorId: 0x1ccf, productId: 0x8048, usagePage: 0xffeb, usage: 0x01 }  // IIDX Premium
];

function isBeefDevice(device: HIDDevice): boolean {
  if (device.vendorId === 0xfeed && device.productId === 0x0000) return device.productName === 'BEEF BOARD';
  if (device.vendorId !== 0x1ccf) return false;
  if (device.productId === 0x1018) return entryProductNames.has(device.productName);
  if (device.productId === 0x8048) return premiumProductNames.has(device.productName);
  return false;
}

export async function waitForReconnection(timeoutMs = 15000): Promise<void> {
  await onDisconnect();
  const deadline = Date.now() + timeoutMs;
  const requestPermissionAt = Date.now() + 2000;
  let requestedNewIdentity = false;
  while (Date.now() < deadline) {
    let selectedDevice = (await navigator.hid.getDevices()).find(isBeefDevice);
    // Changing controller mode also changes VID/PID. Chromium may therefore
    // treat the restarted board as a new WebHID identity even though Electron's
    // device policy allows it. Re-run the chooser once in the desktop app so
    // the new identity is granted without making the user reconnect the cable.
    if (!selectedDevice && !requestedNewIdentity && window.beefNative && Date.now() >= requestPermissionAt) {
      requestedNewIdentity = true;
      try {
        selectedDevice = (await navigator.hid.requestDevice({ filters: beefHidFilters })).find(isBeefDevice);
      } catch {
        // Keep polling: getDevices() may become available after enumeration.
      }
    }
    if (selectedDevice) {
      if (!selectedDevice.opened) await selectedDevice.open();
      appState.device = selectedDevice;
      navigator.hid.addEventListener('disconnect', onDisconnect);
      appState.error = undefined;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Controller restarted, but automatic reconnection timed out');
}

export async function detectDevice(): Promise<HIDDevice | null> {
  const devices = await navigator.hid.requestDevice({
    filters: beefHidFilters
  });

  if (devices.length === 0) {
    return null;
  }

  // Shouldn't be necessary, but let's play it safe
  const selectedDevice = devices.find(isBeefDevice);
  if (!selectedDevice) {
    throw new Error('Invalid device found, is this an official Konami controller?');
  }

  if (!selectedDevice.opened) {
    await selectedDevice.open();
  }
  return selectedDevice;
}

export type FirmwareInfo = {
  version: string | null;
};

export async function readFirmwareInfo(): Promise<FirmwareInfo> {
  if (!appState.device) {
    throw new Error('Device not connected');
  }

  try {
    const result = await appState.device.receiveFeatureReport(ReportId.FirmwareVersion);
    const data = new DataView(result.buffer, result.byteOffset + 1, result.byteLength - 1);
    const hasSemanticVersion = data.byteLength >= 7;
    const version = hasSemanticVersion ? `${data.getUint8(4)}.${data.getUint8(5)}.${data.getUint8(6)}` : null;
    return { version };
  } catch (err) {
    throw new Error('Failed to read firmware information', { cause: err });
  }
}

export async function sendCommand(command: Command): Promise<void> {
  if (!appState.device) {
    throw new Error('Device not connected');
  }

  try {
    const commandData = new Uint8Array([command]);
    await appState.device.sendFeatureReport(ReportId.Command, commandData);
  } catch (err) {
    throw new Error('Failed to send command', { cause: err });
  }
}
