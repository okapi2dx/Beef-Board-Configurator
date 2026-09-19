import { Command, detectDevice, sendCommand, waitForReconnection } from "$lib/types/hid";

class AppState {
  disableConfigTab = $state(false);
  device = $state<HIDDevice | null>(null);
  error = $state<string | undefined>();
  connecting = $state(false);
}

export const appState = new AppState();

export async function onDisconnect(): Promise<void> {
  navigator.hid.removeEventListener('disconnect', onDisconnect);
  try { await appState.device?.close(); } catch { /* Device may already be unplugged. */ }
  appState.disableConfigTab = false;
  appState.device = null;
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
    // Ask the controller firmware to restart its USB device, then wait for
    // Windows/Chromium to enumerate the BEEF BOARD again and reconnect.
    await sendCommand(Command.Restart);
    await waitForReconnection();
  } catch (err) {
    await onDisconnect();
    appState.error = `Error communicating with device: ${err}`;
  } finally {
    appState.connecting = false;
  }
}
