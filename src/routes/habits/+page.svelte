<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { areaFor as areaForHelper, colorClasses } from '$lib/constants/areas';
	import { DAY_NAMES } from '$lib/constants/defaults';
	import { isDueOnDay, heatmapStatus } from '$lib/utils/habits';
	import type { HeatmapStatus } from '$lib/utils/habits';
	import { Archive, ArchiveRestore } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	// ── Add habit form state ──────────────────────────────────────────────────
	let showAddForm = $state(false);
	let newName = $state('');
	let newArea = $state('personal');
	let newFrequency = $state('daily');
	// customDays is a Set of selected day abbreviations — toggled by checkboxes
	let customDays = $state(new Set<string>());

	// Compute the hidden customDays input value: comma-separated, ordered Mon→Sun
	const customDaysValue = $derived(
		DAY_NAMES.filter((d) => customDays.has(d)).join(',')
	);

	// ── Derived: habits due today ─────────────────────────────────────────────
	const dueToday = $derived(
		data.habits.filter((h) => isDueOnDay(h.frequency, h.customDays ?? null, data.todayWeekday))
	);

	// ── Helpers ───────────────────────────────────────────────────────────────
	function areaFor(key: string | null | undefined) {
		return areaForHelper(key, data.areas);
	}

	// Returns weekday abbreviation for a date string
	function weekdayFor(dateStr: string): string {
		return new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Kolkata',
			weekday: 'short'
		}).format(new Date(dateStr + 'T00:00:00+05:30'));
	}

	// Heatmap square Tailwind classes per status
	const HEATMAP_CLASSES: Record<HeatmapStatus, string> = {
		done: 'bg-green-500',
		skipped: 'bg-yellow-400',
		missed: 'bg-red-500/40',
		pending: 'bg-[#1e1e2e] ring-1 ring-white/20',
		future: 'bg-[#1e1e2e]',
		'not-scheduled': 'bg-[#0c0c0f]'
	};

	const HEATMAP_TITLE: Record<HeatmapStatus, string> = {
		done: 'Done',
		skipped: 'Skipped',
		missed: 'Missed',
		pending: 'Pending (today)',
		future: 'Upcoming',
		'not-scheduled': 'Not scheduled'
	};

	function toggleCustomDay(day: string) {
		if (customDays.has(day)) {
			customDays.delete(day);
		} else {
			customDays.add(day);
		}
		// Reassign to trigger reactivity
		customDays = new Set(customDays);
	}

	// Reset form after successful submission
	function resetForm() {
		newName = '';
		newArea = 'personal';
		newFrequency = 'daily';
		customDays = new Set();
		showAddForm = false;
	}

	// Skip error state — per habit
	let skipErrors = $state<Record<string, string>>({});
</script>

<div class="space-y-8">
	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="font-display text-2xl font-bold text-[#e2e2e8]">Habits</h1>
			<p class="font-mono text-sm text-[#6b6b7a]">{data.habits.length} active</p>
		</div>
		<button
			onclick={() => (showAddForm = !showAddForm)}
			class="rounded-lg border border-[#1e1e2e] bg-[#161620] px-3 py-1.5 font-mono text-xs
				text-[#e2e2e8] transition-colors hover:border-[#2a2a3e]"
		>
			{showAddForm ? 'Cancel' : '+ Add habit'}
		</button>
	</div>

	<!-- ── Add Habit Form ───────────────────────────────────────────────────── -->
	{#if showAddForm}
		<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
			<h2 class="mb-4 font-display text-sm font-semibold text-[#e2e2e8]">New habit</h2>
			<form
				method="POST"
				action="?/addHabit"
				use:enhance={() => {
					return async ({ update, result }) => {
						await update();
						if (result.type !== 'failure') resetForm();
					};
				}}
				class="space-y-4"
			>
				<!-- Name -->
				<div>
					<label class="mb-1 block font-mono text-xs text-[#6b6b7a]">Name</label>
					<input
						type="text"
						name="name"
						bind:value={newName}
						required
						placeholder="e.g. Morning workout"
						class="w-full rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
							font-mono text-sm text-[#e2e2e8] placeholder-[#3a3a4e]
							focus:outline-none focus:ring-1 focus:ring-white/20"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<!-- Area -->
					<div>
						<label class="mb-1 block font-mono text-xs text-[#6b6b7a]">Area</label>
						<select
							name="area"
							bind:value={newArea}
							class="w-full rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
								font-mono text-xs text-[#e2e2e8] focus:outline-none focus:ring-1 focus:ring-white/20"
						>
							{#each data.areas.filter(a => !a.suspended) as a}
								<option value={a.key}>{a.emoji} {a.label}</option>
							{/each}
						</select>
					</div>

					<!-- Frequency -->
					<div>
						<label class="mb-1 block font-mono text-xs text-[#6b6b7a]">Frequency</label>
						<select
							name="frequency"
							bind:value={newFrequency}
							class="w-full rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
								font-mono text-xs text-[#e2e2e8] focus:outline-none focus:ring-1 focus:ring-white/20"
						>
							<option value="daily">Daily</option>
							<option value="weekdays">Weekdays (Mon–Fri)</option>
							<option value="3x">3× week (Mon/Wed/Fri)</option>
							<option value="custom">Custom days</option>
						</select>
					</div>
				</div>

				<!-- Custom days picker — only shown when frequency = 'custom' -->
				{#if newFrequency === 'custom'}
					<div>
						<label class="mb-2 block font-mono text-xs text-[#6b6b7a]">Select days</label>
						<div class="flex flex-wrap gap-2">
							{#each DAY_NAMES as day}
								<button
									type="button"
									onclick={() => toggleCustomDay(day)}
									class="rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors
										{customDays.has(day)
										? 'border-white/30 bg-white/10 text-white'
										: 'border-[#1e1e2e] bg-[#0c0c0f] text-[#6b6b7a]'}"
								>
									{day}
								</button>
							{/each}
						</div>
					</div>
					<!-- Hidden input carries the selected days to the server -->
					<input type="hidden" name="customDays" value={customDaysValue} />
				{/if}

				<button
					type="submit"
					class="rounded-lg bg-white px-4 py-2 font-mono text-xs font-semibold text-[#0c0c0f]
						transition-opacity hover:opacity-90"
				>
					Add habit
				</button>
			</form>
		</div>
	{/if}

	<!-- ── Today's Habits ───────────────────────────────────────────────────── -->
	<!--
		Only shows habits due today. Each has a checkbox (toggleLog) and a Skip
		button (skipHabit). Skip is limited to 1 per habit per week.
	-->
	<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
		<p class="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
			Today
		</p>

		{#if dueToday.length === 0}
			<p class="font-mono text-xs text-[#6b6b7a]">No habits scheduled for today</p>
		{:else}
			<ul class="space-y-3">
				{#each dueToday as habit}
					{@const todayLog = data.logMap[habit.id]?.[data.todayStr]}
					{@const isDone = todayLog?.status === 'done'}
					{@const isSkipped = todayLog?.status === 'skipped'}
					{@const area = areaFor(habit.area)}

					<li class="flex items-center gap-3">
						<!-- Checkbox: toggles done/not-done -->
						<form method="POST" action="?/toggleLog" use:enhance>
							<input type="hidden" name="habitId" value={habit.id} />
							<button
								type="submit"
								class="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors
									{isDone
									? 'border-green-500 bg-green-500 text-[#0c0c0f]'
									: isSkipped
										? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
										: 'border-[#2a2a3e] bg-[#0c0c0f] hover:border-white/30'}"
								title={isDone ? 'Mark undone' : 'Mark done'}
							>
								{#if isDone}
									<span class="font-mono text-[10px] font-bold">✓</span>
								{:else if isSkipped}
									<span class="font-mono text-[10px]">–</span>
								{/if}
							</button>
						</form>

						<!-- Habit name + area badge -->
						<div class="flex flex-1 items-center gap-2">
							<span
								class="font-mono text-sm {isDone || isSkipped
									? 'text-[#6b6b7a] line-through'
									: 'text-[#e2e2e8]'}"
							>
								{habit.name}
							</span>
							{#if area}
								<span
									class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px]
										{colorClasses(area.color).bg} {colorClasses(area.color).text}"
								>
									{area.emoji}
								</span>
							{/if}
							{#if isSkipped}
								<span class="font-mono text-[10px] text-yellow-400">skipped</span>
							{/if}
						</div>

						<!-- Streak badge -->
						{#if data.streaks[habit.id] > 0}
							<span class="font-mono text-xs text-[#6b6b7a]" title="Current streak">
								🔥 {data.streaks[habit.id]}
							</span>
						{/if}

						<!-- Skip button (only visible if not already done/skipped) -->
						{#if !isDone && !isSkipped}
							<form
								method="POST"
								action="?/skipHabit"
								use:enhance={() => {
									return async ({ result, update }) => {
										if (result.type === 'failure') {
											skipErrors[habit.id] = 'Skip limit reached this week';
											setTimeout(() => delete skipErrors[habit.id], 3000);
										}
										await update();
									};
								}}
							>
								<input type="hidden" name="habitId" value={habit.id} />
								<button
									type="submit"
									class="rounded border border-[#1e1e2e] px-2 py-0.5 font-mono text-[10px]
										text-[#6b6b7a] transition-colors hover:border-yellow-400/30 hover:text-yellow-400"
									title="Skip today (max 1×/week)"
								>
									skip
								</button>
							</form>
						{/if}
					</li>

					<!-- Skip error tooltip -->
					{#if skipErrors[habit.id]}
						<li class="pl-8">
							<p class="font-mono text-[10px] text-red-400">{skipErrors[habit.id]}</p>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}
	</div>

	<!-- ── All Habits (with heatmap) ────────────────────────────────────────── -->
	<!--
		Full list of active habits. Each row shows:
		  area badge | name | frequency | heatmap (7 squares) | streak | archive button
	-->
	<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
		<p class="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
			All habits
		</p>

		{#if data.habits.length === 0}
			<p class="font-mono text-xs text-[#6b6b7a]">No habits yet</p>
		{:else}
			<ul class="space-y-4">
				{#each data.habits as habit}
					{@const area = areaFor(habit.area)}

					<li class="flex flex-col gap-2">
						<!-- Top row: area badge, name, frequency, streak, archive -->
						<div class="flex items-center gap-2">
							{#if area}
								<span
									class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5
										font-mono text-[10px] {colorClasses(area.color).bg} {colorClasses(area.color).text}"
								>
									{area.emoji}
									{area.label}
								</span>
							{/if}

							<span class="flex-1 font-mono text-sm text-[#e2e2e8]">{habit.name}</span>

							<span class="font-mono text-[10px] text-[#6b6b7a]">
								{habit.frequency === 'daily'
									? 'Daily'
									: habit.frequency === 'weekdays'
										? 'Weekdays'
										: habit.frequency === '3x'
											? '3× week'
											: 'Custom'}
							</span>

							{#if data.streaks[habit.id] > 0}
								<span class="font-mono text-xs text-[#6b6b7a]" title="Streak">
									🔥 {data.streaks[habit.id]}
								</span>
							{/if}

							<!-- Archive (soft delete) -->
							<form method="POST" action="?/archiveHabit" use:enhance>
								<input type="hidden" name="id" value={habit.id} />
								<button
									type="submit"
									class="rounded p-1 text-[#6b6b7a] transition-colors hover:bg-red-500/10 hover:text-red-400"
									title="Archive habit"
								>
									<Archive size={13} />
								</button>
							</form>
						</div>

						<!-- Heatmap row: 7 squares for Mon–Sun -->
						<!--
							Each square represents one day of the current week.
							Color encodes status: done=green, skipped=yellow,
							missed=faint red, pending=outlined, future/not-scheduled=dim
						-->
						<div class="flex gap-1 pl-1">
							{#each data.weekDates as date, i}
								{@const weekday = weekdayFor(date)}
								{@const log = data.logMap[habit.id]?.[date]}
								{@const status = heatmapStatus(
									habit.frequency,
									habit.customDays ?? null,
									weekday,
									date,
									data.todayStr,
									log
								)}
								<div
									class="h-4 w-4 rounded-sm {HEATMAP_CLASSES[status]}"
									title="{date} ({weekday}) — {HEATMAP_TITLE[status]}"
								></div>
							{/each}
							<!-- Day labels below squares -->
						</div>
						<!-- Weekday labels aligned under heatmap squares -->
						<div class="flex gap-1 pl-1">
							{#each data.weekDates as _, i}
								<div class="w-4 text-center font-mono text-[8px] text-[#3a3a4e]">
									{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
								</div>
							{/each}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- ── Archived Habits ──────────────────────────────────────────────────── -->
	{#if data.archivedHabits.length > 0}
		<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
			<p class="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
				Archived ({data.archivedHabits.length})
			</p>
			<ul class="space-y-2">
				{#each data.archivedHabits as habit}
					{@const area = areaFor(habit.area)}
					<li class="flex items-center gap-2 opacity-50">
						{#if area}
							<span
								class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5
									font-mono text-[10px] {colorClasses(area.color).bg} {colorClasses(area.color).text}"
							>
								{area.emoji}
							</span>
						{/if}
						<span class="flex-1 font-mono text-sm text-[#e2e2e8] line-through">{habit.name}</span>
						<form method="POST" action="?/unarchiveHabit" use:enhance>
							<input type="hidden" name="id" value={habit.id} />
							<button
								type="submit"
								class="rounded p-1 text-[#6b6b7a] transition-colors hover:bg-green-500/10 hover:text-green-400"
								title="Restore habit"
							>
								<ArchiveRestore size={13} />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
