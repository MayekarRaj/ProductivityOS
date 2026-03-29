<script lang="ts">
	import '../app.css';
	import { page, navigating } from '$app/stores';
	import { onNavigate } from '$app/navigation';

	// lucide-svelte — same icons as lucide-react but for Svelte
	import { Sun, CalendarDays, Dumbbell, BarChart2, Settings } from 'lucide-svelte';

	// Svelte 5: layout receives children as a snippet (replaces <slot />)
	let { children } = $props();

	// Tab definitions — icon is a Svelte component reference, not a string
	const tabs = [
		{ href: '/today', label: 'Today', icon: Sun },
		{ href: '/week', label: 'Week', icon: CalendarDays },
		{ href: '/habits', label: 'Habits', icon: Dumbbell },
		{ href: '/stats', label: 'Stats', icon: BarChart2 },
		{ href: '/settings', label: 'Settings', icon: Settings }
	] as const;

	// 10.5: View Transitions API — cross-fade between tab pages.
	// onNavigate fires before the new page renders; returning a Promise
	// tells SvelteKit to wait for the animation before swapping the DOM.
	// document.startViewTransition is only available in modern browsers;
	// the guard ensures the rest work without it.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<div class="min-h-screen bg-[#0c0c0f] text-[#e2e2e8]">
	<!-- 10.6: Navigation loading bar — thin purple line at top during page transitions -->
	{#if $navigating}
		<div class="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-[#161620]">
			<div class="h-full animate-[loading_1s_ease-in-out_infinite] bg-purple-500"></div>
		</div>
	{/if}

	<!-- ── Main content ─────────────────────────────────────────────────────── -->
	<!-- pb-24: padding so content doesn't hide behind the fixed bottom nav     -->
	<!-- safe-area-inset-bottom handles notched iPhones via viewport-fit=cover  -->
	<main class="mx-auto max-w-2xl px-4 pt-6 pb-24" style="padding-bottom: max(6rem, calc(5rem + env(safe-area-inset-bottom)))">
		{@render children()}
	</main>

	<!-- ── Bottom NavBar ─────────────────────────────────────────────────────── -->
	<!-- fixed: stays at bottom even when scrolling                              -->
	<!-- z-50: renders above page content                                        -->
	<nav class="fixed right-0 bottom-0 left-0 z-50 border-t border-[#1e1e2e] bg-[#161620]"
		style="padding-bottom: env(safe-area-inset-bottom)">
		<div class="mx-auto flex h-16 max-w-2xl items-center justify-around px-4">
			{#each tabs as tab}
				<!-- $page is a Svelte store — prefix $ to read its value reactively -->
				<!-- When URL changes, $page.url.pathname updates automatically       -->
				{@const active = $page.url.pathname === tab.href}
				<!-- {@const} must be a direct child of a block tag ({#each}, {#if}, etc.) -->
				<!-- NOT inside a regular HTML element like <a> — that's a compile error  -->
				{@const Icon = tab.icon}

				<a
					href={tab.href}
					class="flex flex-col items-center gap-1 px-4 py-2 transition-colors duration-150
					       {active ? 'text-purple-400' : 'text-[#6b6b7a] hover:text-[#e2e2e8]'}"
				>
					<Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
					<span class="font-mono text-xs">{tab.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
