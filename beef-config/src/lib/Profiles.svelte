<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { tr } from '$lib/types/locale.svelte';
  import type { Config } from '$lib/types/config.svelte';
  let { config = $bindable(), onApplied, lightingOnly = false }: { config: Config, onApplied?: () => void, lightingOnly?: boolean } = $props();
  let name = $state('');
  let profiles = $state<Record<string, unknown>>({});
  let key = $derived(lightingOnly ? 'beef-board-light-presets-v1' : 'beef-board-profiles-v1');
  $effect(() => { try { profiles = JSON.parse(localStorage.getItem(key) || '{}'); } catch { profiles = {}; } });
  function persist() { localStorage.setItem(key, JSON.stringify(profiles)); profiles = { ...profiles }; }
  // Svelte class state uses prototype accessors, which JSON.stringify omits.
  function snapshot(value: any): any {
    if (Array.isArray(value)) return value.map(snapshot);
    if (!value || typeof value !== 'object') return value;
    const fields = new Set([...Object.keys(value), ...Object.getOwnPropertyNames(Object.getPrototypeOf(value))]);
    return Object.fromEntries([...fields].filter(k => k !== 'constructor' && !k.startsWith('__') && typeof value[k] !== 'function').map(k => [k, snapshot(value[k])]));
  }
  function save() {
    const n = name.trim(); if (!n || n === '__proto__') return;
    const saved = snapshot(config);
    profiles[n] = lightingOnly ? Object.fromEntries(Object.entries(saved).filter(([k]) => k === 'version' || k.includes('hsv') || k.includes('effect') || k.startsWith('button_led') || k === 'disable_leds' || k === 'rainbow_spin_speed')) : saved;
    persist();
  }
  function assign(target: any, source: any) {
    for (const [k, value] of Object.entries(source ?? {})) {
      if (!(k in target) || ['version', '__proto__', 'constructor', 'prototype'].includes(k)) continue;
      if (Array.isArray(target[k]) && Array.isArray(value)) target[k].splice(0, target[k].length, ...value);
      else if (target[k] && typeof target[k] === 'object' && value && typeof value === 'object') assign(target[k], value);
      else target[k] = value;
    }
  }
  function load(n: string) {
    const saved = profiles[n] as { version?: number };
    if (!saved?.version || saved.version > config.version) return;
    assign(config, saved); onApplied?.();
  }
  function remove(n: string) { delete profiles[n]; persist(); }
</script>
<section class="mb-5 rounded-md border p-3">
  <h2 class="mb-2 text-lg font-bold">{lightingOnly ? tr('自分のLEDプリセット', 'My LED Presets') : tr('設定プロファイル', 'Configuration Profiles')}</h2>
  <div class="mb-2 flex gap-2"><Input placeholder={tr('プロファイル名', 'Profile name')} bind:value={name}/><Button onclick={save}>{tr('保存', 'Save')}</Button></div>
  {#each Object.keys(profiles) as profile}
    <div class="mb-1 flex items-center justify-between"><span>{profile}</span><span class="flex gap-2"><Button size="sm" onclick={() => load(profile)}>{tr('読込', 'Load')}</Button><Button size="sm" variant="outline" onclick={() => remove(profile)}>{tr('削除', 'Delete')}</Button></span></div>
  {/each}
</section>
