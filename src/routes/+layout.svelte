<script lang="ts">
	import '../app.css';
	import { page, navigating } from '$app/stores';
	import { onNavigate } from '$app/navigation';
	import { Sun, CalendarDays, Dumbbell, BarChart2, Settings, Bell } from 'lucide-svelte';

	let { children } = $props();

	const tabs = [
		{ href: '/today',    label: 'Today',    icon: Sun },
		{ href: '/week',     label: 'Week',     icon: CalendarDays },
		{ href: '/habits',   label: 'Habits',   icon: Dumbbell },
		{ href: '/stats',    label: 'Stats',    icon: BarChart2 },
		{ href: '/settings', label: 'Settings', icon: Settings }
	] as const;

	// View Transitions API — cross-fade between pages
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

<div class="min-h-screen bg-[#12121c] text-[#e8e6f0]">

	<!-- ── Loading bar ──────────────────────────────────────────────────────── -->
	{#if $navigating}
		<div class="fixed top-0 left-0 right-0 z-[100] h-px bg-[#1f1f29]">
			<div class="h-full animate-[loading_1s_ease-in-out_infinite] bg-violet-500"></div>
		</div>
	{/if}

	<!-- ── Top nav bar (desktop lg+) ────────────────────────────────────────── -->
	<!--
		Hidden on mobile — bottom nav handles that.
		bg-[#1b1b25] is "surface-container-low" — slightly lighter than the base,
		no border needed because the tone shift is enough to separate it.
	-->
	<header class="hidden lg:flex fixed top-0 left-0 right-0 z-50 h-13 items-center gap-8 px-8 bg-[#1b1b25]">
		<!-- Logo -->
		<span class="font-display text-sm font-bold tracking-tight text-violet-500 shrink-0">
			Planner
		</span>

		<!-- Center tabs -->
		<nav class="flex items-center gap-1">
			{#each tabs as tab}
				{@const active = $page.url.pathname.startsWith(tab.href)}
				<a
					href={tab.href}
					class="px-3 py-1.5 font-mono text-[11px] tracking-wide rounded transition-colors
					       {active
					         ? 'text-violet-500 bg-violet-500/10'
					         : 'text-[#9e9eb4] hover:text-[#e8e6f0] hover:bg-white/5'}"
				>
					{tab.label}
				</a>
			{/each}
		</nav>

		<!-- Right — bell + avatar -->
		<div class="ml-auto flex items-center gap-4">
			<button class="text-[#9e9eb4] hover:text-[#e8e6f0] transition-colors" aria-label="Notifications">
				<Bell size={15} strokeWidth={1.5} />
			</button>
			<!-- Avatar — single-user app, initials placeholder -->
			<div class="h-7 w-7 rounded bg-violet-500/15 flex items-center justify-center
			            font-mono text-[10px] font-semibold text-violet-500 select-none">
				R
			</div>
		</div>
	</header>

	<!-- ── Main content ──────────────────────────────────────────────────────── -->
	<!--
		pt-6 on mobile (no top nav), pt-[60px] on desktop (clears the 52px header).
		pb-24 on mobile (clears bottom nav), lg:pb-10 on desktop.
		max-w-[1280px] gives a comfortable reading width on large monitors.
	-->
	<main
		class="mx-auto max-w-[1280px] px-4 lg:px-8 pt-6 lg:pt-16"
		style="padding-bottom: max(6rem, calc(5rem + env(safe-area-inset-bottom)))"
	>
		{@render children()}
	</main>

	<!-- ── Bottom nav (mobile only) ─────────────────────────────────────────── -->
	<nav
		class="lg:hidden fixed right-0 bottom-0 left-0 z-50 bg-[#1b1b25]"
		style="padding-bottom: env(safe-area-inset-bottom)"
	>
		<div class="flex h-16 items-center justify-around px-4">
			{#each tabs as tab}
				{@const active = $page.url.pathname.startsWith(tab.href)}
				{@const Icon = tab.icon}
				<a
					href={tab.href}
					class="flex flex-col items-center gap-1 px-3 py-2 transition-colors
					       {active ? 'text-violet-500' : 'text-[#9e9eb4]'}"
				>
					<Icon size={19} strokeWidth={active ? 2.5 : 1.5} />
					<span class="font-mono text-[9px] tracking-wide">{tab.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
