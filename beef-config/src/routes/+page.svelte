<script lang="ts">
	import { onMount } from 'svelte';

	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Tabs from '$lib/components/ui/tabs';

	import ConfigScreen from '$lib/ConfigScreen.svelte';
	import FirmwareScreen from '$lib/FirmwareScreen.svelte';
	import NativeFirmwareScreen from '$lib/NativeFirmwareScreen.svelte';
	import LightDarkModeToggle from '$lib//LightDarkModeToggle.svelte';
	import LanguageSelect from '$lib/LanguageSelect.svelte';
	import { initializeLocale, tr } from '$lib/types/locale.svelte';
	import { readFirmwareInfo, type FirmwareInfo } from '$lib/types/hid';

	import { connectDevice, appState } from '$lib/types/state.svelte';

	const Tab = {
		Config: 'config',
		Firmware: 'dfu'
	} as const;

	let browserSupported = $state(false);
	let activeTab = $state<string>(Tab.Config);
	let loading = $state(true);
	let nativeFlash = $state(false);
	let updateInfo = $state<Awaited<ReturnType<NonNullable<Window['beefNative']>['checkForUpdates']>>>(null);
	let firmwareInfo = $state<FirmwareInfo | null>(null);

	onMount(async () => {
		initializeLocale();
		nativeFlash = !!window.beefNative;
		checkBrowserSupport();
		loading = false;
		if (window.beefNative) updateInfo = await window.beefNative.checkForUpdates();
	});

	function checkBrowserSupport(): void {
		browserSupported = 'hid' in navigator && 'usb' in navigator;
	}

	$effect(() => {
		const current = appState.device;
		if (!current) {
			firmwareInfo = null;
			return;
		}
		void readFirmwareInfo().then((info) => {
			if (appState.device === current) firmwareInfo = info;
		}).catch(() => {
			if (appState.device === current) firmwareInfo = null;
		});
	});
</script>

<main class="mx-auto max-w-(--breakpoint-lg) p-4">
	<title>Beef Board Configurator v1.00.1</title>
	<div class="flex justify-between">
		<h1 class="mb-4 flex items-baseline gap-2 text-2xl font-bold">
			<span>Beef Board Configurator</span><span class="text-base font-semibold text-muted-foreground">v1.00.1</span>
		</h1>
		<div class="flex items-center gap-3">
			{#if appState.device && firmwareInfo}
				<div class="text-sm text-muted-foreground">
					{tr('現在のファームウェア', 'Current firmware')}: {firmwareInfo.version ? `V${firmwareInfo.version}` : tr('バージョン情報なし', 'version unavailable')}
				</div>
			{/if}
			<LanguageSelect />
			<LightDarkModeToggle />
		</div>
	</div>
	{#if updateInfo?.updateAvailable}
		<Alert class="mb-4">
			<AlertTitle>{tr('アップデートがあります', 'Update available')}</AlertTitle>
			<AlertDescription class="flex flex-wrap items-center justify-between gap-3">
				<span>{tr(`最新版 ${updateInfo.latestVersion} が利用できます。`, `Version ${updateInfo.latestVersion} is available.`)}</span>
				<Button variant="outline" size="sm" onclick={() => window.beefNative?.openUpdate(updateInfo!.releaseUrl)}>
					{tr('Releaseを開く', 'Open Release')}
				</Button>
			</AlertDescription>
		</Alert>
	{/if}

	{#if loading}
		<Skeleton class="h-10" />
	{:else if !browserSupported}
		<Alert variant="destructive">
			<AlertTitle>Browser Not Supported</AlertTitle>
			<AlertDescription>
				WebHID/WebUSB is not supported in this browser. Please use a compatible browser like Chrome
				or Edge.
			</AlertDescription>
		</Alert>
	{:else}
		{#if !appState.device}
			<p class="mb-4 text-sm text-muted-foreground">BEEF BOARDをUSBで接続し、「接続」を押してください。設定画面はアプリ内で動作します。</p>
			<Button onclick={connectDevice} disabled={appState.disableConfigTab} class="mb-4">接続 / Connect Device</Button>
		{/if}
			<Tabs.Root bind:value={activeTab}>
				<Tabs.List class="mb-4 flex w-full flex-row justify-center">
					<Tabs.Trigger value={Tab.Config} disabled={appState.disableConfigTab} class="grow"
						>{tr('設定', 'Config')}</Tabs.Trigger
					>
					<Tabs.Trigger value={Tab.Firmware} class="grow">{tr('ファームウェア', 'Firmware')}</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value={Tab.Config}>{#if appState.device}<ConfigScreen active={activeTab === Tab.Config} />{:else}<p>{tr('設定する場合は機器に接続してください。ファームウェアは「ファームウェア」タブから選択できます。', 'Connect a device to configure it. Firmware can be selected from the Firmware tab.')}</p>{/if}</Tabs.Content>
				<Tabs.Content value={Tab.Firmware}>{#if nativeFlash}<NativeFirmwareScreen />{:else}<FirmwareScreen />{/if}</Tabs.Content>
			</Tabs.Root>

		{#if appState.error}
			<Alert variant="destructive" class="mt-4">
				<AlertTitle>{tr('エラー', 'Error')}</AlertTitle>
				<AlertDescription>{appState.error}</AlertDescription>
			</Alert>
		{/if}
	{/if}
</main>

