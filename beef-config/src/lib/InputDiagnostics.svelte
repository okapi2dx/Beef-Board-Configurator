<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { readDiagnostics } from '$lib/types/hid';
  import { tr } from '$lib/types/locale.svelte';
  let running = $state(false), error = $state(''), rate = $state(0);
  let data = $state({ buttons: 0, sensorAB: 0, raw: 0, filtered: 0, output: 0, direction: 0, transitions: 0, intervalMs: 0, ledLevels: Array(11).fill(0) });
  let timer: ReturnType<typeof setTimeout> | undefined, previousCount = 0, previousTime = 0, pending = false;
  async function poll() {
    if (!running || pending) return;
    pending = true;
    try {
      const next = await readDiagnostics(); if (!running) return; const now = performance.now();
      if (previousTime) rate = Math.round(((next.transitions - previousCount) >>> 0) * 1000 / (now - previousTime));
      previousCount = next.transitions; previousTime = now; data = next; error = '';
    } catch (e) { error = `${e}`; running = false; }
    finally { pending = false; }
    if (running) timer = setTimeout(poll, 100);
  }
  function toggle() { running = !running; if (running) { previousTime = 0; void poll(); } else clearTimeout(timer); }
  onDestroy(() => { running = false; clearTimeout(timer); });
</script>
<section class="mb-5 rounded-md border p-3">
  <div class="mb-2 flex items-center justify-between"><h3 class="text-lg font-bold">{tr('入力テスト・ターンテーブル診断', 'Input Test & Turntable Diagnostics')}</h3><Button onclick={toggle}>{running ? tr('停止', 'Stop') : tr('開始', 'Start')}</Button></div>
  <div class="mb-3 grid grid-cols-7 gap-1">{#each Array(11) as _, i}<div class:opacity-30={!((data.buttons >> i) & 1)} class="rounded bg-primary p-2 text-center text-primary-foreground">{i + 1}</div>{/each}</div>
  <div class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
    <span>A/B: {String(data.sensorAB >> 1 & 1)}/{String(data.sensorAB & 1)}</span><span>{tr('方向', 'Direction')}: {data.direction}</span>
    <span>{tr('生入力', 'Raw')}: {data.raw}</span><span>{tr('出力', 'Output')}: {data.output}</span>
    <span>{tr('遷移数', 'Transitions')}: {data.transitions}</span><span>{tr('遷移/秒', 'Edges/sec')}: {rate}</span><span>{tr('最終間隔', 'Last interval')}: {data.intervalMs}ms</span>
  </div>
  <p class="mt-3 text-sm">{tr('ボタンLED出力（％）', 'Button LED output (%)')}: {data.ledLevels.join(' / ')}</p>
  {#if error}<p class="mt-2 text-destructive">{error}</p>{/if}
</section>
