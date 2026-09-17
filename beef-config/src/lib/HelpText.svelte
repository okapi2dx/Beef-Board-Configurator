<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { tr } from '$lib/types/locale.svelte';
  let { children, label = '' }: { children: import('svelte').Snippet; label?: string } = $props();
</script>
<Tooltip.Provider delayDuration={150}>
  <Tooltip.Root>
    <Tooltip.Trigger
      class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-xs font-bold text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={tr(label + 'の説明', 'Help: ' + label)}
    >?</Tooltip.Trigger>
    <Tooltip.Content class="z-50 max-w-[min(24rem,90vw)] p-3 text-sm leading-relaxed">
      {@render children()}
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
