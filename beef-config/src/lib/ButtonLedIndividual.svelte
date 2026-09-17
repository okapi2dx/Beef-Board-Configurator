<script lang="ts">
  import SliderInput from '$lib/SliderInput.svelte'; import Switch from '$lib/Switch.svelte';
  import { Label } from '$lib/components/ui/label'; import { tr } from '$lib/types/locale.svelte';
  import type { Config } from '$lib/types/config.svelte';
  let { config = $bindable() }: { config: Config } = $props();
</script>
<Switch label={tr('ボタンごとに設定', 'Configure Each Button')} bind:checked={config.button_led_individual}/>
{#if config.button_led_individual}
  <div class="grid gap-3 sm:grid-cols-2">
  {#each Array(11) as _, i}
    <div class="rounded border p-2"><strong>{tr('ボタン', 'Button')} {i + 1}</strong>
      <Label for={`led-fade-${i}`}>{tr('フェード（ms）', 'Fade (ms)')}</Label><SliderInput bind:value={config.button_led_fade[i]} min={0} max={255} id={`led-fade-${i}`}/>
      <Label for={`led-level-${i}`}>{tr('明るさ（％）', 'Brightness (%)')}</Label><SliderInput bind:value={config.button_led_level[i]} min={0} max={100} id={`led-level-${i}`}/>
      <Switch label={`${tr('反転', 'Invert')} ${i + 1}`} bind:checked={config.button_led_inverted[i]}/>
    </div>
  {/each}
  </div>
{/if}
