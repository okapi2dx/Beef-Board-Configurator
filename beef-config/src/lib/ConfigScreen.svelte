<script lang="ts">
	import { onMount } from 'svelte';
	import * as Tabs from '$lib/components/ui/tabs';

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
	let {
		active = true,
		settingsTab = $bindable('input'),
		showTabs = true
	}: { active?: boolean; settingsTab?: string; showTabs?: boolean } = $props();
	let controllerRestarting = $state(false);
	function controllerModeLabel(mode: ControllerType): string {
		if (mode === ControllerType.Default) return tr('デフォルト', 'Default');
		if (mode === ControllerType.IIDXEntry) return 'IIDX Entry';
		return 'IIDX Premium';
	}

	async function changeControllerMode(mode: ControllerType): Promise<void> {
		if (!config || mode === config.controller_type || controllerRestarting) return;
		controllerRestarting = true;
		appState.connecting = true;
		appState.error = undefined;
		try {
			config.controller_type = mode;
			await updateConfig(config);

			// Changing controller mode changes the USB identity. The device can
			// disappear before Chromium resolves sendFeatureReport(), so a send
			// error can still mean that the restart command succeeded.
			try {
				await sendCommand(Command.Restart);
			} catch {
				// Always continue into USB re-enumeration/reconnection.
			}

			await waitForReconnection(20000);
			config = await readConfig();
		} catch (err) {
			appState.error = `${err}`;
		} finally {
			appState.connecting = false;
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
  {#if showTabs}
  <Tabs.List class="mb-5 grid h-auto w-full grid-cols-4" aria-label={tr('設定カテゴリ', 'Settings categories')}>
    <Tabs.Trigger value="input">{tr('入力設定', 'Input')}</Tabs.Trigger>
    <Tabs.Trigger value="led">{tr('LED設定', 'LEDs')}</Tabs.Trigger>
    <Tabs.Trigger value="keys">{tr('キー割り当て', 'Key Bindings')}</Tabs.Trigger>
    <Tabs.Trigger value="monitor">{tr('モニター', 'Monitor')}</Tabs.Trigger>
  </Tabs.List>
  {/if}
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
					>
						<p>{tr('回転し始めてから、設定時間を超えて同じ方向の回転が続くと入力を開始します。', 'Input starts after rotation continues in the same direction longer than the configured time.')}</p>
						<p>{tr('短い揺れや誤反応を無視するための設定です。0msで無効になり、停止または逆方向へ回すと判定時間をリセットします。', 'This helps ignore brief movement and false input. Set 0 ms to disable it; stopping or reversing resets the timer.')}</p>
					</ToolTipLabel
				>
				<SliderInput bind:value={config.tt_deadzone} min={config.version >= 22 ? 0 : 1} max={config.version >= 22 ? 255 : 6} id="tt-deadzone" />
			</div>

			{#if config.version >= 12}
				<div class="mb-4">
					<ToolTipLabel forId="tt-sustain-ms" label={tr('ターンテーブル保持時間（ms）', 'Turntable Hold Time (ms)')}>
						<p>{tr('回転が止まったあとも、最後の回転方向の入力を設定時間だけ維持します。0msでは保持しません。', 'Keeps input active in the last rotation direction for the configured time after the turntable stops. Set 0 ms for no hold time.')}</p>
						<p>{tr('値を大きくすると入力が途切れにくくなります。大きすぎると停止時の反応が遅くなります。', 'Higher values reduce input dropouts. Values that are too high make stopping feel less immediate.')}</p>
					</ToolTipLabel>
					<SliderInput bind:value={config.tt_sustain_ms} min={0} max={255} id="tt-sustain-ms" />
				</div>
			{/if}

			{#if config.version >= 21}
				<div class="mb-4">
					<ToolTipLabel forId="tt-delay-ms" label={tr('ターンテーブル入力ディレイ（ms）', 'Turntable Input Delay (ms)')}>
						<p>{tr('回転を検出してから、ゲームへ入力を送るまでの待ち時間です。', 'Sets the delay between detecting turntable movement and sending the input to the game.')}</p>
						<p>{tr('0msで遅延なし。アナログ・デジタルの両方に適用されます。', 'Set 0 ms for no delay. This applies to both analog and digital input.')}</p>
					</ToolTipLabel>
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
					<ToolTipLabel forId="iidx-button-debounce" label={tr('ボタンのデバウンス（ms）', 'Button Debounce (ms)')}>
						<p>{tr('最初の押下はすぐに入力します。その後、設定時間内の同じボタンの再押下を無視します。', 'The first press is accepted immediately. Repeated presses of the same button within the configured time are ignored.')}</p>
						<p>{tr('チャタリング対策用です。ボタンを離したときはすぐ解除し、0msで無効になります。', 'This reduces switch chatter. Release is immediate, and 0 ms disables the filter.')}</p>
					</ToolTipLabel>
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
						<ToolTipLabel forId="button-led-fade" label={tr('フェードアウト時間（ms）', 'Fade-out Time (ms)')}>
							<p>{tr('ボタンLEDが消灯するときに、設定した時間をかけて徐々に暗くします。', 'Sets how long a button LED takes to fade out when it turns off.')}</p>
							<p>{tr('0msではフェードせず、すぐに消灯します。', 'At 0 ms, the LED turns off immediately without fading.')}</p>
						</ToolTipLabel>
						<SliderInput bind:value={config.button_led_fade_ms} min={0} max={config.version >= 27 ? 1000 : 255} id="button-led-fade" />
					</div>
					<div class="mb-4">
						<ToolTipLabel forId="button-led-brightness" label={tr('ボタンLEDの明るさ（％）', 'Button LED Brightness (%)')}>
							<p>{tr('ボタンLEDの最大明るさを設定します。100％が最大、0％で消灯です。', 'Sets the maximum button LED brightness. 100% is full output and 0% keeps the LEDs off.')}</p>
							<p>{tr('ゲームから送られる点灯指示にも、この明るさが適用されます。', 'This brightness also applies to lighting commands sent by the game.')}</p>
						</ToolTipLabel>
						<SliderInput bind:value={config.button_led_brightness} min={0} max={100} id="button-led-brightness" />
					</div>
					<Switch label={tr('ボタンLEDを反転', 'Invert Button LEDs')} bind:checked={config.button_led_invert}>
						<p>{tr('OFFでは、ボタンを押している間だけLEDが点灯します。', 'OFF lights the LED while the button is pressed.')}</p>
						<p>{tr('ONでは動作が反転し、ボタンを離している間に点灯します。フェードアウトは消灯時に適用されます。', 'ON reverses the behavior and lights the LED while the button is released. Fade-out applies when the LED turns off.')}</p>
					</Switch>
					
				{:else}
					<p class="mb-4">{tr('ボタンLEDの調整にはファームウェアV1.00以降へ更新してください。', 'Update to firmware V1.00 or later to adjust button LEDs.')}</p>
				{/if}
				{#if config.version >= 19}
					<Switch label={tr('ターンテーブルとセンターバーの発光効果を連動', 'Link Turntable and Light Bar Effects')} bind:checked={config.link_bar_effect} />
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
					<p class="mb-4 text-sm">{tr('センターバーにターンテーブルと同じ発光効果と色を反映します。', 'The light bar follows the turntable effect and color.')}</p>
				{:else}
					{@const barModeMapping = config.version >= 17 ? Object.values(BarMode) : Object.values(BarMode).filter((mode) => mode !== BarMode.Static)}
					<LightEffectSelect
						label={tr('センターバーの発光効果', 'Light Bar Effect')}
						bind:effect={config.bar_effect}
						modeMapping={barModeMapping}
					/>
					{#if config.version >= 17 && config.bar_effect === BarMode.Static}
						<ColorPicker bind:hsv={config.bar_static_hsv} />
					{:else if config.version < 17}
						<p class="mb-4 text-sm">{tr('センターバーの固定色を使うには、対応ファームウェアへ更新してください。', 'Update the firmware to use a static light bar color.')}</p>
					{/if}
				{/if}

				{#if config.version >= 16}
					<Separator class="mb-4" />
					<div class="mb-4">
						<ToolTipLabel forId="led-refresh" label={tr('RGB LED更新頻度', 'RGB LED Refresh Rate')}>
							<p>{tr('RGB LEDを1秒間に更新する回数を設定します。', 'Sets how many times per second the RGB LEDs are updated.')}</p>
							<p>{tr('値を上げるとアニメーションが滑らかになりますが、処理負荷も増えます。', 'Higher values make animations smoother but increase processing load.')}</p>
						</ToolTipLabel>
						<SliderInput bind:value={config.led_refresh} min={1} max={60} id="led-refresh" />
					</div>

					<div class="mb-4">
						<ToolTipLabel
							forId="rainbow-spin-speed"
							label={tr('レインボー効果の回転速度', 'Rainbow Effect Spin Speed')}
						>
							<p>{tr('レインボー系エフェクトの色が動く速さを設定します。', 'Sets how quickly rainbow colors move.')}</p>
							<p>{tr('値を大きくすると、色の移動や反応が速くなります。', 'Higher values make the color movement and response faster.')}</p>
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
							<p>{tr('ターンテーブルに接続しているRGB LEDの個数を設定します。初期値は24です。', 'Sets the number of RGB LEDs connected to the turntable. The default is 24.')}</p>
							<p>{tr('実際に接続しているLED数と同じ値にしてください。変更後は「再接続」で反映されます。', 'Use the actual number of connected LEDs. Changes are applied after Reconnect.')}</p>
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

					{#if config.version >= 32}
						<div class="mb-4">
							<ToolTipLabel forId="bar-leds" label={tr('センターバーLED数', 'Center Bar LEDs')}>
								<p>{tr('センターバーに接続しているRGB LEDの個数を設定します。初期値は16です。', 'Sets the number of RGB LEDs connected to the center bar. The default is 16.')}</p>
								<p>{tr('実際に接続しているLED数と同じ値にしてください。変更後は「再接続」で反映されます。', 'Use the actual number of connected LEDs. Changes are applied after Reconnect.')}</p>
							</ToolTipLabel>
							<Input
								class="w-1/5"
								id="bar-leds"
								min={1}
								max={255}
								type="number"
								bind:value={config.bar_leds}
							/>
						</div>
					{:else}
						<p class="mb-4 text-sm">{tr('センターバーLED数の変更には、対応ファームウェアへ更新してください。', 'Update to compatible firmware to change the center bar LED count.')}</p>
					{/if}
				{/if}
			{/if}
		</div>
	{/if}
</Tabs.Content>
  <Tabs.Content value="keys" class="settings-card keys-card">
	{#if config.version >= 13}
		<KeyBinding bind:config />
	{/if}
</Tabs.Content>
  <Tabs.Content value="monitor" class="settings-card"><ControllerMonitor {config} active={active && settingsTab === 'monitor'} /></Tabs.Content>
</Tabs.Root>

{/if}

<style>
  :global(.settings-card) { border: 1px solid var(--border); border-radius: 1rem; padding: 1.25rem; background: var(--card); }
  :global(.settings-card .mb-4) { margin-bottom: 0.75rem; }
  :global(.settings-card h2), :global(.settings-card h3) { font-size: 1.125rem; margin-top: 0.75rem; margin-bottom: 0.75rem; }
  :global(.settings-card label) { line-height: 1.5; }
  :global(.keys-card) { padding-top: 0.75rem; padding-bottom: 0.9rem; }
</style>

