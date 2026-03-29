<script lang="ts">
	import type { PageData } from './$types';
	import { areaFor as areaForHelper, colorClasses } from '$lib/constants/areas';

	let { data }: { data: PageData } = $props();

	const { stats } = data;

	// ── SVG chart helpers ─────────────────────────────────────────────────────
	// Line chart: maps 7 data points into SVG coordinates.
	// viewBox is 300×80. x steps evenly, y is inverted (SVG 0 = top).

	const CHART_W = 300;
	const CHART_H = 80;
	const CHART_PAD = 10;

	function linePoints(values: number[], maxVal: number): string {
		if (maxVal === 0) return '';
		const usableH = CHART_H - CHART_PAD * 2;
		const stepX = (CHART_W - CHART_PAD * 2) / (values.length - 1);
		return values
			.map((v, i) => {
				const x = CHART_PAD + i * stepX;
				const y = CHART_PAD + usableH - (v / maxVal) * usableH;
				return `${x},${y}`;
			})
			.join(' ');
	}

	// Energy values for the line chart (0 if not set)
	const energyValues = $derived(stats.dayStats.map((d) => d.energyValue));
	const completionValues = $derived(stats.dayStats.map((d) => Math.round(d.completionRate * 4))); // scale to 0–4

	// Max for area bar chart
	const maxAreaTasks = $derived(
		stats.areaStats.length > 0 ? Math.max(...stats.areaStats.map((a) => a.tasksTotal)) : 1
	);

	function areaFor(key: string) {
		return areaForHelper(key, data.areas);
	}
</script>

<div class="space-y-6">
	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<div>
		<h1 class="font-display text-2xl font-bold text-[#e2e2e8]">Stats</h1>
		<p class="font-mono text-sm text-[#6b6b7a]">This week at a glance</p>
	</div>

	<!-- ── 5.1 Summary Cards ────────────────────────────────────────────────── -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each [
			{ label: 'Tasks done', value: stats.tasksDoneTotal, icon: '✓' },
			{ label: 'MVD days', value: stats.mvdDays, icon: '🎯' },
			{ label: 'Habits done', value: stats.habitsCompleted, icon: '🔁' },
			{ label: 'Pomodoros', value: stats.pomodorosTotal, icon: '🍅' }
		] as card}
			<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-4">
				<p class="font-mono text-lg">{card.icon}</p>
				<p class="font-display text-2xl font-bold text-[#e2e2e8]">{card.value}</p>
				<p class="font-mono text-xs text-[#6b6b7a]">{card.label}</p>
			</div>
		{/each}
	</div>

	<!-- ── 5.5 Weekly Wins ──────────────────────────────────────────────────── -->
	{#if stats.wins.length > 0}
		<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
			<p class="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
				Weekly wins
			</p>
			<ul class="space-y-1.5">
				{#each stats.wins as win}
					<li class="flex items-start gap-2 font-mono text-sm text-[#e2e2e8]">
						<span class="mt-0.5 text-green-400">✦</span>
						{win}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- ── 5.3 Energy vs Completion ─────────────────────────────────────────── -->
	<!--
		Dual line chart — energy level (red) and task completion scaled to 0–4 (blue).
		Both use the same 0–4 scale so they can share one SVG.
		7 data points = Mon–Sun.
	-->
	<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
		<p class="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
			Energy vs Completion
		</p>
		<p class="mb-4 font-mono text-[10px] text-[#3a3a4e]">
			<span class="text-red-400">─</span> energy &nbsp;
			<span class="text-blue-400">─</span> task completion (scaled)
		</p>

		{#if energyValues.some((v) => v > 0) || completionValues.some((v) => v > 0)}
			<svg
				viewBox="0 0 {CHART_W} {CHART_H}"
				class="w-full"
				preserveAspectRatio="none"
				style="height: 80px"
			>
				<!-- Grid lines -->
				{#each [1, 2, 3, 4] as level}
					<line
						x1={CHART_PAD}
						y1={CHART_PAD + (CHART_H - CHART_PAD * 2) - (level / 4) * (CHART_H - CHART_PAD * 2)}
						x2={CHART_W - CHART_PAD}
						y2={CHART_PAD + (CHART_H - CHART_PAD * 2) - (level / 4) * (CHART_H - CHART_PAD * 2)}
						stroke="#1e1e2e"
						stroke-width="1"
					/>
				{/each}

				<!-- Energy line -->
				{#if energyValues.some((v) => v > 0)}
					<polyline
						points={linePoints(energyValues, 4)}
						fill="none"
						stroke="#ef4444"
						stroke-width="1.5"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
					{#each energyValues as v, i}
						{#if v > 0}
							{@const x = CHART_PAD + i * ((CHART_W - CHART_PAD * 2) / (energyValues.length - 1))}
							{@const y = CHART_PAD + (CHART_H - CHART_PAD * 2) - (v / 4) * (CHART_H - CHART_PAD * 2)}
							<circle cx={x} cy={y} r="2.5" fill="#ef4444" />
						{/if}
					{/each}
				{/if}

				<!-- Completion line -->
				{#if completionValues.some((v) => v > 0)}
					<polyline
						points={linePoints(completionValues, 4)}
						fill="none"
						stroke="#3b82f6"
						stroke-width="1.5"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
				{/if}
			</svg>

			<!-- Day labels -->
			<div class="mt-1 flex justify-between px-[10px]">
				{#each stats.dayStats as d}
					<span class="font-mono text-[9px] text-[#3a3a4e]">{d.weekday}</span>
				{/each}
			</div>
		{:else}
			<p class="font-mono text-xs text-[#6b6b7a]">No data yet — log energy on the Today tab</p>
		{/if}
	</div>

	<!-- ── 5.2 Area Breakdown ────────────────────────────────────────────────── -->
	<!--
		Horizontal bar chart — one bar per area that has tasks this week.
		Bar width = (tasksTotal / max) * 100%. Done tasks shown as a filled segment.
	-->
	<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
		<p class="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
			Area breakdown
		</p>

		{#if stats.areaStats.length === 0}
			<p class="font-mono text-xs text-[#6b6b7a]">No tasks this week yet</p>
		{:else}
			<ul class="space-y-3">
				{#each stats.areaStats as area}
					{@const barWidth = (area.tasksTotal / maxAreaTasks) * 100}
					{@const doneWidth = area.tasksTotal > 0 ? (area.tasksDone / area.tasksTotal) * barWidth : 0}
					{@const a = areaFor(area.key)}

					<li class="space-y-1">
						<div class="flex items-center justify-between">
							<span class="font-mono text-xs {colorClasses(a?.color ?? 'purple').text}">
								{area.emoji} {area.label}
							</span>
							<span class="font-mono text-xs text-[#6b6b7a]">
								{area.tasksDone}/{area.tasksTotal}
							</span>
						</div>
						<!-- Track -->
						<div class="relative h-2 w-full rounded-full bg-[#1e1e2e]">
							<!-- Total bar (faint background) -->
							<div
								class="absolute left-0 top-0 h-full rounded-full {colorClasses(a?.color ?? 'purple').bg}"
								style="width: {barWidth}%"
							></div>
							<!-- Done bar (solid fill using border color as bg) -->
							<div
								class="absolute left-0 top-0 h-full rounded-full {colorClasses(a?.color ?? 'purple').solid}"
								style="width: {doneWidth}%"
							></div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- ── 5.4 Habit Consistency ─────────────────────────────────────────────── -->
	<!--
		Sorted worst → best. Shows done/due count and a small progress bar.
		Helps identify which habits need attention.
	-->
	<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
		<p class="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
			Habit consistency
		</p>

		{#if stats.habitConsistency.length === 0}
			<p class="font-mono text-xs text-[#6b6b7a]">No habits tracked yet</p>
		{:else}
			<ul class="space-y-3">
				{#each stats.habitConsistency as habit}
					{@const a = areaFor(habit.area)}
					<li class="space-y-1">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								{#if a}
									<span class="font-mono text-[10px] {colorClasses(a.color).text}">{a.emoji}</span>
								{/if}
								<span class="font-mono text-xs text-[#e2e2e8]">{habit.name}</span>
							</div>
							<span
								class="shrink-0 font-mono text-xs font-semibold
								{habit.percent === 100
									? 'text-green-400'
									: habit.percent >= 60
										? 'text-[#e2e2e8]'
										: 'text-red-400'}"
							>
								{habit.percent}%
							</span>
						</div>
						<div class="relative h-1.5 w-full rounded-full bg-[#1e1e2e]">
							<div
								class="absolute left-0 top-0 h-full rounded-full transition-all
								{habit.percent === 100
									? 'bg-green-500'
									: habit.percent >= 60
										? 'bg-blue-500'
										: 'bg-red-500'}"
								style="width: {habit.percent}%"
							></div>
						</div>
						<p class="font-mono text-[10px] text-[#3a3a4e]">
							{habit.doneCount}/{habit.dueCount} days
						</p>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
