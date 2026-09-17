<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import { ControllerType } from '$lib/types/types.svelte';
	import { IIDXKeyMapping, type Config } from '$lib/types/config.svelte';
	import { getKeyCode, getKeyName } from '$lib/types/hid-codes';
	import { appState } from '$lib/types/state.svelte';
	import { tr } from '$lib/types/locale.svelte';

	interface Props {
		config: Config;
	}

	let { config = $bindable() }: Props = $props();

	let selectedButton: number | null = $state(null);
	let resetOpen = $state(false);

	// Button labels
	const IIDX_BUTTON_LABELS = {
		main_buttons: ['1', '2', '3', '4', '5', '6', '7'],
		function_buttons: ['E1', 'E2', 'E3', 'E4'],
		tt_ccw: 'TT-',
		tt_cw: 'TT+'
	};
	const BUTTON_LAYOUT_LABELS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'E1', 'E2', 'E3', 'E4'];

	function startKeyCapture(button: number) {
		selectedButton = button;
		window.addEventListener('keydown', handleKeyDown);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (selectedButton === null) return;

		event.preventDefault();
		window.removeEventListener('keydown', handleKeyDown);

		const hidKeyCode = getKeyCode(event.code);
		if (hidKeyCode) {
			switch (config.controller_type) {
				case ControllerType.Default:
				case ControllerType.IIDXEntry:
				case ControllerType.IIDXPremium:
					if (selectedButton < 7) {
						config.iidx_keys.main_buttons[selectedButton] = hidKeyCode;
					} else if (selectedButton < 11) {
						config.iidx_keys.function_buttons[selectedButton - 7] = hidKeyCode;
					} else if (selectedButton === 11) {
						config.iidx_keys.tt_ccw = hidKeyCode;
					} else if (selectedButton === 12) {
						config.iidx_keys.tt_cw = hidKeyCode;
					}
					break;
			}
		} else {
			appState.error = `Cannot bind button to ${event.code}`;
		}

		selectedButton = null;
	}

	function resetKeys() {
		config.iidx_keys = new IIDXKeyMapping();
		config.button_mapping = BUTTON_LAYOUT_LABELS.map((_, i) => i);
		selectedButton = null;
		window.removeEventListener('keydown', handleKeyDown);
		resetOpen = false;
	}

	function changeButtonMapping(physical: number, value: string | null | undefined) {
		if (value == null) return;
		const logical = Number(value);
		if (!Number.isInteger(logical) || logical < 0 || logical >= BUTTON_LAYOUT_LABELS.length) return;
		const previous = config.button_mapping[physical];
		if (previous === logical) return;

		// Keep the mapping one-to-one. Selecting an already-used destination swaps
		// the two physical buttons rather than creating duplicate outputs.
		const otherPhysical = config.button_mapping.indexOf(logical);
		const next = [...config.button_mapping];
		next[physical] = logical;
		if (otherPhysical >= 0) next[otherPhysical] = previous;
		config.button_mapping = next;
	}

</script>

<div class="mb-4">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-xl font-bold">{tr('キー割り当て', 'Key Bindings')}</h3>
		<AlertDialog.Root bind:open={resetOpen}>
			<AlertDialog.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="destructive">{tr('キーを初期化', 'Reset Keys')}</Button>
				{/snippet}
			</AlertDialog.Trigger>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>{tr('キー割り当てを初期化しますか？', 'Reset Key Bindings?')}</AlertDialog.Title>
					<AlertDialog.Description>
						{tr('すべてのキー割り当てとボタン配置を初期値に戻します。', 'This will reset all key bindings and the button layout to their default values.')}
					</AlertDialog.Description>
				</AlertDialog.Header>
				<AlertDialog.Footer>
					<AlertDialog.Action onclick={resetKeys}>{tr('初期化', 'Reset')}</AlertDialog.Action>
					<AlertDialog.Cancel>{tr('キャンセル', 'Cancel')}</AlertDialog.Cancel>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog.Root>
	</div>

	{#if Object.values(ControllerType).includes(config.controller_type)}
		{#if config.version >= 28}
			<div class="mb-5">
				<div class="mb-2">
					<div>
						<h3 class="text-xl font-bold">{tr('ボタン配置入れ替え', 'Button Layout Remapping')}</h3>
						<p class="text-sm text-muted-foreground">
							{tr('物理ボタンを別の論理ボタンとして動作させます。重複する割り当てを選ぶと、2つのボタンを自動で入れ替えます。', 'Map each physical button to a different logical button. Choosing a destination already in use automatically swaps the two buttons.')}
						</p>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
					{#each BUTTON_LAYOUT_LABELS as physicalLabel, i}
						<div class="rounded-md border p-3">
							<Label>{physicalLabel} → {BUTTON_LAYOUT_LABELS[config.button_mapping[i]]}</Label>
							<Select.Root
								type="single"
								value={String(config.button_mapping[i])}
								onValueChange={(value) => changeButtonMapping(i, value)}
							>
								<Select.Trigger class="mt-2 w-full">{BUTTON_LAYOUT_LABELS[config.button_mapping[i]]}</Select.Trigger>
								<Select.Content>
									<Select.Group>
										{#each BUTTON_LAYOUT_LABELS as logicalLabel, logical}
											<Select.Item value={String(logical)}>{logicalLabel}</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>
					{/each}
				</div>
			</div>
			<Separator class="mb-4" />
		{/if}

		<Label>{tr('メインボタン', 'Main Buttons')}</Label>
		<div class="mb-2 flex flex-col">
			<div class="grid grid-cols-4 gap-2">
				{#each IIDX_BUTTON_LABELS.main_buttons as label, i}
					<Button
						variant={selectedButton === i ? 'default' : 'outline'}
						onclick={() => startKeyCapture(i)}
					>
						{label}: {getKeyName(config.iidx_keys.main_buttons[i])}
					</Button>
				{/each}
			</div>
		</div>

		<Label>{tr('機能ボタン', 'Function Buttons')}</Label>
		<div class="mb-2 flex flex-col">
			<div class="grid grid-cols-4 gap-2">
				{#each IIDX_BUTTON_LABELS.function_buttons as label, i}
					<Button
						variant={selectedButton === i + 7 ? 'default' : 'outline'}
						onclick={() => startKeyCapture(i + 7)}
					>
						{label}: {getKeyName(config.iidx_keys.function_buttons[i])}
					</Button>
				{/each}
			</div>
		</div>

		<Label>{tr('ターンテーブル', 'Turntable')}</Label>
		<div class="mb-2 flex flex-col">
			<div class="grid grid-cols-2 gap-2">
				<Button
					variant={selectedButton === 11 ? 'default' : 'outline'}
					onclick={() => startKeyCapture(11)}
				>
					{IIDX_BUTTON_LABELS.tt_ccw}: {getKeyName(config.iidx_keys.tt_ccw)}
				</Button>
				<Button
					variant={selectedButton === 12 ? 'default' : 'outline'}
					onclick={() => startKeyCapture(12)}
				>
					{IIDX_BUTTON_LABELS.tt_cw}: {getKeyName(config.iidx_keys.tt_cw)}
				</Button>
			</div>
		</div>
	{/if}

	{#if selectedButton !== null}
		<div class="bg-muted mt-4 rounded-md p-4">{tr('割り当てるキーを押してください…', 'Press any key to bind...')}</div>
	{/if}
</div>
