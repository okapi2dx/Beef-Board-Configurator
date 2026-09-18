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
		if (config.button_mapping[physical] === logical) return;

		// Multiple physical buttons may intentionally produce the same logical
		// button, so only update the selected physical input.
		const next = [...config.button_mapping];
		next[physical] = logical;
		config.button_mapping = next;
	}

	// Match the controller monitor's physical IIDX layout exactly.
	const IIDX_REMAP_POSITIONS = [
		[45, 175],
		[75, 105],
		[105, 175],
		[135, 105],
		[165, 175],
		[195, 105],
		[225, 175],
		[45, 15],
		[105, 15],
		[165, 15],
		[225, 15]
	];

</script>

<div class="key-binding-root">
	<div class="key-binding-header flex items-center justify-between">
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
			<div class="remap-section">
				<div class="remap-heading">
					<div>
						<h3 class="text-xl font-bold">{tr('ボタン配置入れ替え', 'Button Layout Remapping')}</h3>
						<p class="text-sm text-muted-foreground">
							{tr('物理ボタンを別の論理ボタンとして動作させます。同じ論理ボタンへの重複割り当ても可能です。', 'Map each physical button to a logical button. Multiple physical buttons may share the same logical button.')}
						</p>
					</div>
				</div>
				<div class="remap-stage">
					<div class="remap-keyboard">
						{#each BUTTON_LAYOUT_LABELS as physicalLabel, i}
							<div
								class="remap-key"
								class:black={i < 7 && i % 2 === 1}
								class:function-key={i >= 7}
								style:left={`${(IIDX_REMAP_POSITIONS[i][0] / 310) * 100}%`}
								style:top={`${(IIDX_REMAP_POSITIONS[i][1] / 260) * 100}%`}
							>
								<strong>{physicalLabel}</strong>
								<span class="remap-arrow">↓</span>
								<Select.Root
									type="single"
									value={String(config.button_mapping[i])}
									onValueChange={(value) => changeButtonMapping(i, value)}
								>
									<Select.Trigger class="remap-select">
										{BUTTON_LAYOUT_LABELS[config.button_mapping[i]]}
									</Select.Trigger>
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

<style>
	.key-binding-root {
		margin: 0;
	}
	.key-binding-header {
		margin-bottom: 4px;
	}
	.remap-section {
		margin-bottom: 10px;
	}
	.remap-heading {
		margin-bottom: 5px;
	}
	.remap-heading h3 {
		margin-top: 0 !important;
		margin-bottom: 4px !important;
	}
	.remap-heading p {
		line-height: 1.35;
	}
	.remap-stage {
		background: #0f172a;
		border-radius: 12px;
		padding: 9px 12px 11px;
		color: #e2e8f0;
		min-width: 0;
	}
	.remap-keyboard {
		position: relative;
		width: min(100%, 520px);
		aspect-ratio: 310 / 260;
		margin: 0 auto;
		padding: 1.5%;
		background: linear-gradient(145deg, #e8edf2, #c4ced8);
		border: 2px solid #718094;
		border-radius: 12px;
		box-shadow: inset 0 0 0 1px #f8fafc, 0 8px 20px rgba(2, 6, 23, 0.22);
	}
	.remap-key {
		position: absolute;
		width: 17%;
		height: 22%;
		border: 2px solid #7b8797;
		border-radius: 8px;
		background: #edf1f6;
		color: #172033;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 5px;
		box-shadow: inset 0 -3px #bac4d0;
		transition: background 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
	}
	.remap-key:hover,
	.remap-key:focus-within {
		background: #2563eb;
		border-color: #60a5fa;
		color: #fff;
		box-shadow: inset 0 -3px rgba(30, 64, 175, 0.75), 0 0 0 3px rgba(59, 130, 246, 0.2);
		transform: translateY(-1px);
	}
	.remap-key.function-key {
		height: 17%;
	}
	.remap-key.black {
		background: #202b3b;
		color: #fff;
	}
	.remap-key.black:hover,
	.remap-key.black:focus-within {
		background: #1d4ed8;
		border-color: #60a5fa;
	}
	.remap-key strong {
		font-size: 15px;
		font-weight: 800;
		line-height: 1;
	}
	.remap-arrow {
		font-size: 14px;
		font-weight: 800;
		line-height: 1;
		opacity: 0.78;
	}
	:global(.remap-select) {
		height: 30px !important;
		min-height: 30px !important;
		width: 58px !important;
		padding: 0 7px !important;
		gap: 3px !important;
		font-size: 13px !important;
		font-weight: 800 !important;
		line-height: 1 !important;
		background: #fff !important;
		color: #172033 !important;
		border-color: #94a3b8 !important;
		cursor: pointer !important;
	}
	:global(.remap-select:hover),
	:global(.remap-select:focus-visible) {
		border-color: #60a5fa !important;
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.22) !important;
	}
	@media (max-width: 760px) {
		.remap-stage {
			padding: 10px;
			overflow-x: auto;
		}
		.remap-keyboard {
			width: 500px;
		}
	}
</style>
