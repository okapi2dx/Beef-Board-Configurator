import { Command, detectDevice, sendCommand, waitForReconnection } from "$lib/types/hid";

class AppState {
  disableConfigTab = $state(false);
  device = $state<HIDDevice | null>(null);
  error = $state<string | undefined>();
  connecting = $state(false);
}

export const appState = new AppState();

export async function onDisconnect(event?: HIDConnectionEvent): Promise<void> {
  // Ignore a late disconnect event from the old USB instance after a restart.
  // Otherwise it can tear down the newly re-enumerated/reconnected device.
  if (event?.device && appState.device && event.device !== appState.device) return;

  navigator.hid.removeEventListener('disconnect', onDisconnect);
  const device = appState.device;
  appState.device = null;
  try { await device?.close(); } catch { /* Device may already be unplugged. */ }
  appState.disableConfigTab = false;
  appState.error = undefined;
}

async function finishConnection(device: HIDDevice | null): Promise<void> {
  appState.device = device;
  if (!device) return;
  navigator.hid.addEventListener('disconnect', onDisconnect);
  appState.error = undefined;
}

export async function connectDevice(): Promise<void> {
  if (appState.connecting) return;
  appState.connecting = true;
  try {
    await finishConnection(await detectDevice());
  } catch (err) {
    await onDisconnect();
    appState.error = `Error communicating with device: ${err}`;
  } finally {
    appState.connecting = false;
  }
}

export async function reconnectDevice(): Promise<void> {
  if (appState.connecting) return;
  if (!appState.device) {
    await connectDevice();
    return;
  }

  appState.connecting = true;
  appState.error = undefined;
  try {
    // The controller can disappear from USB before Chromium resolves the
    // SET_REPORT promise. A send error here can therefore mean the restart
    // command already succeeded, so always continue into re-enumeration.
    try {
      await sendCommand(Command.Restart);
    } catch {
      // Expected when the USB restart races the host-side control transfer.
    }
    await waitForReconnection(20000);
  } catch (err) {
    await onDisconnect();
    appState.error = `Error communicating with device: ${err}`;
  } finally {
    appState.connecting = false;
  }
}
