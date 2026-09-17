<script lang="ts">
  import Profiles from '$lib/Profiles.svelte';
  import { Button } from '$lib/components/ui/button'; import { tr } from '$lib/types/locale.svelte';
  import { TurntableMode, BarMode } from '$lib/types/types.svelte'; import type { Config } from '$lib/types/config.svelte';
  let { config = $bindable() }: { config: Config } = $props();
  function color(h:number,s:number,v:number) { for (const hsv of [config.tt_static_hsv, config.tt_spin_hsv, config.tt_react_hsv, config.tt_breathing_hsv, config.bar_static_hsv]) Object.assign(hsv,{h,s,v}); config.disable_leds=false; }
  function preset(kind:string) {
    config.button_led_individual = false;
    config.link_bar_effect = false;
    if(kind==='blue'){color(210,90,100);config.tt_effect=TurntableMode.Spin;config.bar_effect=BarMode.Static;config.button_led_brightness=70;}
    if(kind==='rainbow'){config.disable_leds=false;config.tt_rainbow_spin_hsv.s=100;config.tt_rainbow_spin_hsv.v=100;config.tt_effect=TurntableMode.RainbowSpin;config.link_bar_effect=true;config.button_led_brightness=100;}
    if(kind==='dark'){color(210,80,25);config.tt_effect=TurntableMode.Static;config.bar_effect=BarMode.Static;config.button_led_brightness=25;}
    if(kind==='off')config.disable_leds=true;
  }
</script>
<Profiles bind:config lightingOnly />
<div class="mb-4"><h3 class="mb-2 text-lg font-bold">{tr('LEDプリセット', 'LED Presets')}</h3><div class="flex flex-wrap gap-2"><Button onclick={()=>preset('blue')}>{tr('青白', 'Ice Blue')}</Button><Button onclick={()=>preset('rainbow')}>{tr('レインボー', 'Rainbow')}</Button><Button onclick={()=>preset('dark')}>{tr('暗め', 'Dim')}</Button><Button variant="outline" onclick={()=>preset('off')}>{tr('全消灯', 'All Off')}</Button></div></div>
