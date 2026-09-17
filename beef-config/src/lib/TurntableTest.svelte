<script lang="ts">
  import { readDiagnostics, parseDiagnostics, ReportId } from '$lib/types/hid';
  import { appState } from '$lib/types/state.svelte';
  import { tr } from '$lib/types/locale.svelte';
  let { supported, digital, active, streaming = false }: { supported: boolean; digital: boolean; active: boolean; streaming?: boolean } = $props();
  let value = $state<number | null>(null);
  $effect(() => {
    if (!active || !supported) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const device = appState.device;
    if (!device) return;

    if (streaming) {
      const onInput = (event: HIDInputReportEvent) => {
        if (event.reportId !== ReportId.DiagnosticsStream) return;
        try { value = parseDiagnostics(event.data).output; } catch { /* Ignore malformed packets. */ }
      };
      device.addEventListener('inputreport', onInput);
      return () => device.removeEventListener('inputreport', onInput);
    }

    async function poll() {
      if (disposed || !supported || !device || appState.device !== device) return;
      try {
        const report = await readDiagnostics();
        if (disposed || appState.device !== device) return;
        // Firmware output after deadzone, hold extrapolation and delay.
        value = report.output;
      } catch {
        if (disposed) return;
        // Config writes can briefly overlap a diagnostics read. Keep the last
        // value visible and resume polling after the write has completed.
        if (appState.device === device) timer = setTimeout(poll, 100);
        return;
      }
      timer = setTimeout(poll, 33);
    }
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  });
</script>

<section class="mb-5 rounded-lg border p-3" aria-label={tr('ターンテーブルテスト', 'Turntable Test')}>
  <div class="mb-3 flex items-center justify-between gap-3">
    <span class="font-medium">{tr('ターンテーブルテスト', 'Turntable Test')}</span>
    <output data-testid="turntable-value" class="font-mono text-lg tabular-nums">{value ?? '—'} <span class="text-sm text-muted-foreground">/ 255</span></output>
  </div>
  <div role="meter" aria-label={tr('設定反映後のX軸', 'X axis after all settings')} aria-valuemin={0} aria-valuemax={255} aria-valuenow={value ?? undefined} aria-valuetext={value === null ? tr('未取得', 'Unavailable') : String(value)} class="relative mx-2 h-2 rounded-full bg-muted">
    <div class="h-full rounded-full bg-primary" style:width={`${(value ?? 0) / 255 * 100}%`}></div>
    {#if value !== null}<div class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow" style:left={`${value / 255 * 100}%`}></div>{/if}
  </div>
  <div class="mt-2 flex justify-between text-xs text-muted-foreground"><span>0</span><span>128</span><span>255</span></div>
  <p class="mt-2 text-sm text-muted-foreground">{tr('アナログ設定では、感度・デッドゾーン・保持時間・ディレイを反映したX軸値を表示します。実入力中はX軸をそのまま反映し、入力停止後は最後の方向へ設定した保持時間ぶんX軸入力を続けます。255を超えると0に戻ります。デジタル設定では、ゲームへはX軸ではなくTT-/TT+の方向入力を送り、入力停止後は最後の方向を設定した保持時間だけ維持します。', 'In analog mode, this shows the X-axis value after sensitivity, deadzone, hold time and delay. Real X-axis movement is reflected while input is active. After input stops, X-axis input continues in the last direction for the configured hold time and wraps from 255 to 0. In digital mode, the game receives TT-/TT+ direction input instead of the X-axis, and the last direction is held for the configured hold time after input stops.')}</p>
  {#if digital}<p class="mt-1 text-sm text-muted-foreground">{tr('デジタル設定中は、確認用のアナログX軸値を表示します。ゲームへ送るデジタル入力とは異なります。', 'In digital mode, this displays the analog X-axis preview, not the digital input sent to the game.')}</p>{/if}
  {#if !supported}<p class="mt-2 text-sm">{tr('表示するにはファームウェア1.10.1へ更新してください。', 'Update to firmware 1.10.1 to enable this display.')}</p>{/if}
</section>


