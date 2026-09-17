<script lang="ts">
	import { onMount } from 'svelte';
	import * as Tabs from '$lib/components/ui/tabs';

	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator/index.js';

	import InputModes from '$lib/InputModes.svelte';
	import KeyBinding from '$lib/KeyBinding.svelte';
	import LightEffectSelect from '$lib/LightEffectSelect.svelte';
	import SliderInput from '$lib/SliderInput.svelte';
	import Switch from '$lib/Switch.svelte';
	import ToolTipLabel from '$lib/ToolTipLabel.svelte';
	import TurntableTest from '$lib/TurntableTest.svelte';
	import ControllerMonitor from '$lib/ControllerMonitor.svelte';

	import { readConfig, updateConfig, type Config } from '$lib/types/config.svelte';
	import { Command, sendCommand, waitForReconnection } from '$lib/types/hid';
	import { appState } from '$lib/types/state.svelte';
	import { TurntableMode, BarMode, ControllerType, InputMode } from '$lib/types/types.svelte';
	import WarningAlert from '$lib/WarningAlert.svelte';
	import ColorPicker from '$lib/ColorPicker.svelte';
	import { tr } from '$lib/types/locale.svelte';

	let config: Config | undefined = $state();
	let { active = true }: { active?: boolean } = $props();
	let controllerRestarting = $state(false);
	let settingsTab = $state('input');
	function controllerModeLabel(mode: ControllerType): string {
		if (mode === ControllerType.Default) return tr('デフォルト', 'Default');
		if (mode === ControllerType.IIDXEntry) return 'IIDX Entry';
		return 'IIDX Premium';
	}

	async function changeControllerMode(mode: ControllerType): Promise<void> {
		if (!config || mode === config.controller_type || controllerRestarting) return;
		controllerRestarting = true;
		try {
			config.controller_type = mode;
			await updateConfig(config);
			await sendCommand(Command.Restart);
			await waitForReconnection();
		} catch (err) {
			appState.error = `${err}`;
		} finally {
			controllerRestarting = false;
		}
	}

	onMount(async () => {
		try {
			config = await readConfig();
		} catch (err) {
			appState.error = `${err}`;
		}
	});

	$effect(() => {
		if (config) {
			try {
				void updateConfig(config).catch((err) => { appState.error = `${err}`; });
			} catch (err) {
				appState.error = `${err}`;
			}
		}
	});
</script>

{#if config}
	{#if config.version < 22}
		<WarningAlert
			title={tr('ファームウェアが古いです', 'Outdated Firmware')}
			description={tr('時間式デッドゾーンを使うには、最新のファームウェアへ更新してください。', 'Update the firmware to use the time-based deadzone.')}
		/>
	{/if}

<Tabs.Root bind:value={settingsTab}>
  <Tabs.List class="mb-5 grid h-auto w-full grid-cols-4" aria-label={tr('設定カテゴリ', 'Settings categories')}>
    <Tabs.Trigger value="input">{tr('入力設定', 'Input')}</Tabs.Trigger>
    <Tabs.Trigger value="led">{tr('LED設定', 'LEDs')}</Tabs.Trigger>
    <Tabs.Trigger value="keys">{tr('キー割り当て', 'Key Bindings')}</Tabs.Trigger>
    <Tabs.Trigger value="monitor">{tr('モニター', 'Monitor')}</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="input" class="settings-card">
	<div class="mb-4">
		<Label for="controller-type">{tr('コントローラーモード', 'Controller Mode')}</Label>
		<Select.Root
			type="single"
			value={config.controller_type}
			disabled={controllerRestarting}
			onValueChange={(value) => void changeControllerMode(value as ControllerType)}
		>
			<Select.Trigger class="w-[180px]">{controllerModeLabel(config.controller_type)}</Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each Object.values(ControllerType) as value}
						<Select.Item {value}>{controllerModeLabel(value)}</Select.Item>
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	</div>

	{#if controllerRestarting}
		<WarningAlert
			title={tr('USBを再認識しています', 'Reconnecting USB')}
			description={tr('コントローラーを自動再起動しています。そのままお待ちください。', 'The controller is restarting automatically. Please wait.')}
		/>
	{/if}

	<Separator class="mb-4" />

	{#if Object.values(ControllerType).includes(config.controller_type)}
		<div>
			<h2 class="mb-2 text-xl font-bold">{tr('IIDX設定', 'IIDX Configuration')}</h2>
			<InputModes bind:inputMode={config.iidx_input_mode} />

			<h3 class="mb-2 text-xl font-bold">{tr('ターンテーブル', 'Turntable')}</h3>

			<Switch label={tr('回転方向を反転', 'Reverse Turntable')} bind:checked={config.reverse_tt} />
			{#if config.version >= 20}
				<Switch
					label={config.digital_tt ? tr('ターンテーブル入力：デジタル', 'Turntable Input: Digital') : tr('ターンテーブル入力：アナログ', 'Turntable Input: Analog')}
					bind:checked={config.digital_tt}
				/>
				{#if !config.digital_tt && config.iidx_input_mode === InputMode.Keyboard}
					<p class="mb-4 text-sm">{tr('アナログ入力を使う場合は、入力モードをジョイスティックにしてください。', 'Select Joystick input mode to use analog turntable input.')}</p>
				{/if}
			{/if}
			<div class="mb-4">
				<ToolTipLabel forId="tt-deadzone" label={config.version >= 22 ? tr('ターンテーブルのデッドゾーン（ms）', 'Turntable Deadzone (ms)') : tr('ターンテーブルのデッドゾーン', 'Turntable Deadzone')}
					>{tr('設定時間以下で止まった回転を無視します。設定時間を超えて同じ方向に回転すると入力を開始。0msは判定なし。回転速度に応じて継続を判定し、停止や方向変更で時間を数え直します。', 'Ignores movement lasting no longer than the threshold. Input starts after continued movement exceeds it. 0 ms disables the gate. Continuity adapts to rotation speed; stopping or reversing restarts the timer.')}</ToolTipLabel
				>
				<SliderInput bind:value={config.tt_deadzone} min={config.version >= 22 ? 0 : 1} max={config.version >= 22 ? 255 : 6} id="tt-deadzone" />
			</div>

			{#if config.version >= 12}
				<div class="mb-4">
					<ToolTipLabel forId="tt-sustain-ms" label={tr('ターンテーブル保持時間（ms）', 'Turntable Hold Time (ms)')}>
						<p>{tr('アナログは実際のX軸入力をそのまま反映し、入力が止まった後は最後の方向へ設定した保持時間ぶんX軸入力を続けます。デジタルは最後の方向入力を設定した保持時間だけ維持します。0msで保持なし。', 'Analog input follows the real X-axis movement. After input stops, X-axis input continues in the last direction for the configured hold time. Digital mode keeps the last direction input active for the configured hold time. Set 0 ms to disable.')}</p>
						<p>
							{tr('回し始めと停止時におけるデジタル入力の感度に影響します。', 'This controls digital turntable sensitivity when rotation starts and stops.')}
						</p>
					</ToolTipLabel>
					<SliderInput bind:value={config.tt_sustain_ms} min={0} max={255} id="tt-sustain-ms" />
				</div>
			{/if}

			{#if config.version >= 21}
				<div class="mb-4">
					<ToolTipLabel forId="tt-delay-ms" label={tr('ターンテーブル入力ディレイ（ms）', 'Turntable Input Delay (ms)')}>{tr('0msで遅延なし。アナログ・デジタル両方のターンテーブル入力に適用します。', '0 ms disables the delay. Applies to both analog and digital turntable input.')}</ToolTipLabel>
					<SliderInput bind:value={config.tt_delay_ms} min={0} max={255} id="tt-delay-ms" />
					
				</div>
			{/if}
			<div class="mb-4">
				<Label for="tt-ratio">{tr('ターンテーブル感度', 'Turntable Sensitivity')}</Label>
				<SliderInput bind:value={config.tt_ratio} min={1} max={config.version >= 26 ? 10 : 6} id="tt-ratio" />
			</div>
			<TurntableTest
				active={active && settingsTab === 'input'}
				supported={config.version >= 24}
				digital={Boolean(config.digital_tt)}
				streaming={config.version >= 30}
			/>

			{#if config.version >= 15}
				<Separator class="mb-4" />

				<h3 class="mb-2 text-xl font-bold">{tr('チャタリング防止', 'Debouncing')}</h3>
				<div class="mb-4">
					<ToolTipLabel forId="iidx-button-debounce" label={tr('ボタンのデバウンス（ms）', 'Button Debounce (ms)')}>{tr('最初の押下は即時に入力し、同じボタンの設定時間未満の再押下を無視します。離すとすぐ解除します。無視した押下は後から入力されません。0msで無効。', 'Accepts the first press immediately and ignores new presses of that button within the configured time. Release is immediate; ignored presses are never deferred. 0 ms disables filtering.')}</ToolTipLabel>
					<SliderInput
						bind:value={config.iidx_buttons_debounce}
						min={0}
						max={50}
						id="iidx-button-debounce"
					/>
				</div>

				
			{/if}

		</div>
	{/if}
</Tabs.Content>
  <Tabs.Content value="led" class="settings-card">
	{#if Object.values(ControllerType).includes(config.controller_type)}
		<div>
			<h3 class="mb-2 text-xl font-bold">{tr('ライティング', 'Lights')}</h3>

			<Switch label={tr('LEDを無効にする', 'Disable LEDs')} bind:checked={config.disable_leds} />

			{#if !config.disable_leds}
				<h3 class="mb-2 text-xl font-bold">{tr('ボタンLED', 'Button LEDs')}</h3>
				{#if config.version >= 23}
					<div class="mb-4">
						<ToolTipLabel forId="button-led-fade" label={tr('フェードアウト時間（ms）', 'Fade-out Time (ms)')}>{tr('ボタンLEDが消灯するとき、設定時間をかけて徐々に暗くします。0msではすぐに消灯します。', 'Gradually dims a button LED over the configured time when it turns off. At 0 ms it turns off immediately.')}</ToolTipLabel>
						<SliderInput bind:value={config.button_led_fade_ms} min={0} max={config.version >= 27 ? 1000 : 255} id="button-led-fade" />
					</div>
					<div class="mb-4">
						<ToolTipLabel forId="button-led-brightness" label={tr('ボタンLEDの明るさ（％）', 'Button LED Brightness (%)')}>{tr('5Vでの連続点灯を100％として明るさを調整します。0％では消灯します。ゲームからの点灯指示にも適用されます。', 'Adjusts brightness with continuous 5 V output treated as 100%. At 0% the LEDs remain off. This also applies to lighting commands from the game.')}</ToolTipLabel>
						<SliderInput bind:value={config.button_led_brightness} min={0} max={100} id="button-led-brightness" />
					</div>
					<Switch label={tr('ボタンLEDを反転', 'Invert Button LEDs')} bind:checked={config.button_led_invert}>{tr('OFFでは押すと点灯し、離すと消灯します。ONでは離している間に点灯し、押すと消灯します。フェードアウトは消灯時に適用します。', 'OFF lights the LED while pressed and turns it off on release. ON lights it while released and turns it off when pressed. Fade-out applies whenever it turns off.')}</Switch>
					
				{:else}
					<p class="mb-4">{tr('ボタンLEDの調整にはファームウェア1.10.0以降へ更新してください。', 'Update to firmware 1.10.0 or later to adjust button LEDs.')}</p>
				{/if}
				{#if config.version >= 19}
					<Switch label={tr('ターンテーブルとライトバーの発光効果を連動', 'Link Turntable and Light Bar Effects')} bind:checked={config.link_bar_effect} />
				{/if}
				{@const ttModeMapping = Object.values(TurntableMode)}
				<LightEffectSelect
					label={tr('ターンテーブルの発光効果', 'Turntable Effect')}
					bind:effect={config.tt_effect}
					modeMapping={ttModeMapping}
				/>
				{#if config.tt_effect === TurntableMode.Static}
					<ColorPicker bind:hsv={config.tt_static_hsv} />
				{:else if config.tt_effect === TurntableMode.Spin}
					<ColorPicker bind:hsv={config.tt_spin_hsv} />
				{:else if config.tt_effect === TurntableMode.Shift}
					<ColorPicker bind:hsv={config.tt_shift_hsv} />
				{:else if config.tt_effect === TurntableMode.RainbowStatic}
					<ColorPicker bind:hsv={config.tt_rainbow_static_hsv} />
				{:else if config.tt_effect === TurntableMode.RainbowReactive}
					<ColorPicker bind:hsv={config.tt_rainbow_react_hsv} />
				{:else if config.tt_effect === TurntableMode.RainbowSpin}
					<ColorPicker bind:hsv={config.tt_rainbow_spin_hsv} />
				{:else if config.tt_effect === TurntableMode.Reactive}
					<ColorPicker bind:hsv={config.tt_react_hsv} />
				{:else if config.tt_effect === TurntableMode.Breathing}
					<ColorPicker bind:hsv={config.tt_breathing_hsv} />
				{/if}

				{#if config.version >= 19 && config.link_bar_effect}
					<p class="mb-4 text-sm">{tr('ライトバーにターンテーブルと同じ発光効果と色を反映します。', 'The light bar follows the turntable effect and color.')}</p>
				{:else}
					{@const barModeMapping = config.version >= 17 ? Object.values(BarMode) : Object.values(BarMode).filter((mode) => mode !== BarMode.Static)}
					<LightEffectSelect
						label={tr('ライトバーの発光効果', 'Light Bar Effect')}
						bind:effect={config.bar_effect}
						modeMapping={barModeMapping}
					/>
					{#if config.version >= 17 && config.bar_effect === BarMode.Static}
						<ColorPicker bind:hsv={config.bar_static_hsv} />
					{:else if config.version < 17}
						<p class="mb-4 text-sm">{tr('ライトバーの固定色を使うには、対応ファームウェアへ更新してください。', 'Update the firmware to use a static light bar color.')}</p>
					{/if}
				{/if}

				{#if config.version >= 16}
					<Accordion.Root type="single">
						<Accordion.Item value="item-1">
							<Accordion.Trigger>{tr('詳細設定', 'Advanced')}</Accordion.Trigger>
							<Accordion.Content>
								<div class="mb-4">
									<ToolTipLabel forId="led-refresh" label={tr('RGB LED更新頻度', 'RGB LED Refresh Rate')}>
										<p>
											{tr('RGB LEDを更新する頻度です。値を上げると滑らかになりますが、処理負荷が増えます。', 'Controls how often RGB LEDs update. Higher values make animation smoother but use more processing time.')}
										</p>
									</ToolTipLabel>
									<SliderInput bind:value={config.led_refresh} min={1} max={60} id="led-refresh" />
								</div>

								<div class="mb-4">
									<ToolTipLabel
										forId="rainbow-spin-speed"
										label={tr('レインボー効果の回転速度', 'Rainbow Effect Spin Speed')}
									>
										<p>
											{tr('レインボー系の回転速度と反応速度を設定します。', 'Controls the speed and responsiveness of rainbow effects.')}
										</p>
									</ToolTipLabel>
									<SliderInput
										bind:value={config.rainbow_spin_speed}
										min={1}
										max={5}
										id="rainbow-spin-speed"
									/>
								</div>

								<div class="mb-4">
									<ToolTipLabel forId="tt-leds" label={tr('ターンテーブルLED数', 'Turntable LEDs')}>
										<p>
											{tr('ターンテーブルで点灯するLED数です。値を上げると消費電力と処理負荷が増えます。', 'Controls the number of lit turntable LEDs. Higher values use more power and may affect performance.')}
										</p>
										<br />
										<p>{tr('反映には基板の再起動が必要です。', 'Restart the board to apply this setting.')}</p>
									</ToolTipLabel>
									<Input
										class="w-1/5"
										id="tt-leds"
										min={1}
										max={255}
										type="number"
										bind:value={config.tt_leds}
									/>
								</div>
							</Accordion.Content>
						</Accordion.Item>
					</Accordion.Root>
				{/if}
			{/if}
		</div>
	{/if}
</Tabs.Content>
  <Tabs.Content value="keys" class="settings-card">
	{#if config.version >= 13}
		<Separator class="mb-4" />
		<KeyBinding bind:config />
	{/if}

	<Separator class="mb-4" /></Tabs.Content>
  <Tabs.Content value="monitor" class="settings-card"><ControllerMonitor {config} active={active && settingsTab === 'monitor'} /></Tabs.Content>
</Tabs.Root>

{/if}

{#if settingsTab !== 'monitor'}
<div class="mt-4">
	<AlertDialog.Root>
		<AlertDialog.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="destructive">{tr('設定を初期化', 'Reset Config')}</Button>
			{/snippet}
		</AlertDialog.Trigger>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>{tr('設定を初期化しますか？', 'Reset configuration?')}</AlertDialog.Title>
				<AlertDialog.Description>
					{tr('すべての設定を初期値に戻し、コントローラーを切断します。この操作は元に戻せません。', 'This resets all settings to defaults and disconnects the controller. This action cannot be undone.')}
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Action
					onclick={async () => {
						await sendCommand(Command.ResetConfig);
						await waitForReconnection();
					}}>{tr('続行', 'Continue')}</AlertDialog.Action
				>
				<AlertDialog.Cancel>{tr('キャンセル', 'Cancel')}</AlertDialog.Cancel>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</div>
{/if}
<style>
  :global(.settings-card) { border: 1px solid var(--border); border-radius: 1rem; padding: 1.25rem; background: var(--card); }
  :global(.settings-card .mb-4) { margin-bottom: 0.75rem; }
  :global(.settings-card h2), :global(.settings-card h3) { font-size: 1.125rem; margin-top: 0.75rem; margin-bottom: 0.75rem; }
  :global(.settings-card label) { line-height: 1.5; }
</style>

