<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { areaFor as areaForHelper, colorClasses } from '$lib/constants/areas';
	import { DAY_NAMES } from '$lib/constants/defaults';
	import { isDueOnDay, heatmapStatus } from '$lib/utils/habits';
	import type { HeatmapStatus } from '$lib/utils/habits';
	import { Archive, ArchiveRestore } from 'lucide-svelte';
	import TwoColumnPage from '$lib/components/TwoColumnPage.svelte';
	import PanelCard from '$lib/components/PanelCard.svelte';

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

<TwoColumnPage>
  {#snippet main()}
	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<div class="flex items-center justify-between">
		<div>
			<p class="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b7a]">
				Today's Habits
			</p>
			<div class="flex items-center gap-2">
				<span class="font-mono text-[10px] text-[#3a3a4e]">System.Status:</span>
				<span class="font-mono text-[10px] font-semibold text-green-400">Active</span>
			</div>
		</div>
	</div>

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

	<!-- ── All Habits (table layout with heatmap) ───────────────────────────── -->
	<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
		<div class="space-y-1">
			<p class="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b7a]">
				All Habits
			</p>

			{#if data.habits.length === 0}
				<p class="font-mono text-xs text-[#3a3a4e]">No habits yet — add one from the panel</p>
			{:else}
				<!-- Table header -->
				<div class="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-[#1e1e2e] pb-1.5">
					<span class="font-mono text-[9px] uppercase tracking-[0.1em] text-[#3a3a4e]">Habit / Area</span>
					<span class="font-mono text-[9px] uppercase tracking-[0.1em] text-[#3a3a4e]">7-Day History</span>
					<span class="font-mono text-[9px] uppercase tracking-[0.1em] text-[#3a3a4e]">Streak</span>
				</div>
				<!-- Table rows -->
				{#each data.habits as habit}
					{@const a = areaFor(habit.area)}
					{@const streak = data.streaks[habit.id] ?? 0}
					<div class="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2 border-b border-[#1e1e2e]/40
								last:border-0 hover:bg-[#161620] rounded-lg px-1 transition-colors">
						<!-- Name + Area -->
						<div class="min-w-0">
							<p class="font-mono text-xs text-[#e2e2e8] truncate">{habit.name}</p>
							<div class="flex items-center gap-1.5 mt-0.5">
								{#if a}
									<span class="font-mono text-[9px] uppercase tracking-wide {colorClasses(a.color).text}">
										{a.label}
									</span>
									<span class="text-[#3a3a4e]">·</span>
								{/if}
								<span class="font-mono text-[9px] uppercase text-[#3a3a4e]">{habit.frequency}</span>
							</div>
						</div>
						<!-- 7-day heatmap squares -->
						<div class="flex gap-1">
							{#each data.weekDates as date}
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
								<span
									class="h-4 w-4 rounded-sm {HEATMAP_CLASSES[status]}"
									title={HEATMAP_TITLE[status]}
								></span>
							{/each}
						</div>
						<!-- Streak + archive -->
						<div class="flex items-center gap-2">
							<span class="font-mono text-xs font-semibold text-[#e2e2e8]">{streak}s</span>
							<form method="POST" action={habit.archived ? '?/unarchiveHabit' : '?/archiveHabit'} use:enhance>
								<input type="hidden" name="id" value={habit.id} />
								<button type="submit"
										class="font-mono text-[9px] uppercase text-[#3a3a4e] transition-colors hover:text-[#6b6b7a]">
									{habit.archived ? 'Restore' : 'Archive'}
								</button>
							</form>
						</div>
					</div>
				{/each}
			{/if}
		</div>
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
  {/snippet}

  {#snippet panel()}
    <!-- ── Add Habit Form ── -->
    <PanelCard title="Add Habit">
      <form
        method="POST"
        action="?/addHabit"
        use:enhance={() => {
          return async ({ result, update }) => {
            await update();
            if (result.type !== 'failure') {
              newName = '';
              newFrequency = 'daily';
              customDays = new Set();
            }
          };
        }}
        class="space-y-3"
      >
        <!-- Habit name -->
        <div>
          <label class="mb-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-[#6b6b7a]">
            Habit Name
          </label>
          <input
            type="text"
            name="name"
            bind:value={newName}
            required
            placeholder="e.g. Weekly Review"
            class="w-full border-b border-[#2a2a3e] bg-transparent pb-1.5 font-mono text-sm
                   text-[#e2e2e8] placeholder-[#3a3a4e] outline-none
                   focus:border-violet-500/50 transition-colors"
          />
        </div>

        <!-- Area picker -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="mb-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-[#6b6b7a]">
              Area
            </label>
            <select
              name="area"
              bind:value={newArea}
              class="w-full rounded border border-[#1e1e2e] bg-[#0c0c0f] px-2 py-1.5
                     font-mono text-xs text-[#e2e2e8] outline-none"
            >
              {#each data.areas.filter(a => !a.suspended) as a}
                <option value={a.key}>{a.emoji} {a.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="mb-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-[#6b6b7a]">
              Frequency
            </label>
            <select
              name="frequency"
              bind:value={newFrequency}
              class="w-full rounded border border-[#1e1e2e] bg-[#0c0c0f] px-2 py-1.5
                     font-mono text-xs text-[#e2e2e8] outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="3x">3×/Week</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        <!-- Custom days (only shown when frequency = custom) -->
        {#if newFrequency === 'custom'}
          <input type="hidden" name="customDays" value={customDaysValue} />
          <div class="flex flex-wrap gap-1.5">
            {#each DAY_NAMES as day}
              <button
                type="button"
                onclick={() => {
                  const s = new Set(customDays);
                  if (s.has(day)) s.delete(day); else s.add(day);
                  customDays = s;
                }}
                class="rounded px-2 py-0.5 font-mono text-[10px] transition-colors
                       {customDays.has(day)
                         ? 'bg-violet-500/20 text-violet-400'
                         : 'bg-[#1e1e2e] text-[#6b6b7a] hover:text-[#e2e2e8]'}"
              >{day}</button>
            {/each}
          </div>
        {/if}

        <button
          type="submit"
          class="w-full rounded bg-violet-500/20 py-2 font-mono text-[10px] font-semibold
                 uppercase tracking-[0.12em] text-violet-400 transition-colors
                 hover:bg-violet-500/30"
        >
          Initialize Habit
        </button>
      </form>
    </PanelCard>

    <!-- ── Efficiency Protocol ── -->
    <PanelCard title="Efficiency Protocol">
      <div class="space-y-3">
        <!-- Completion rate -->
        <div>
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-[#6b6b7a]">Completion Rate</span>
            <span class="font-mono text-lg font-bold text-violet-400">
              {data.completionRate ?? 0}%
            </span>
          </div>
          <div class="mt-1.5 h-1 w-full rounded-full bg-[#1e1e2e]">
            <div
              class="h-full rounded-full bg-violet-500 transition-all"
              style="width: {data.completionRate ?? 0}%"
            ></div>
          </div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-[#0c0c0f] p-3">
            <p class="font-mono text-[9px] uppercase tracking-wider text-[#3a3a4e]">Total Streaks</p>
            <p class="mt-0.5 font-mono text-xl font-bold text-[#e2e2e8]">
              {Object.values(data.streaks).reduce((s, v) => s + v, 0)}
            </p>
          </div>
          <div class="rounded-lg bg-[#0c0c0f] p-3">
            <p class="font-mono text-[9px] uppercase tracking-wider text-[#3a3a4e]">Missed Log</p>
            <p class="mt-0.5 font-mono text-xl font-bold text-[#e2e2e8]">
              {data.missedCount ?? 0}
            </p>
          </div>
        </div>
      </div>
    </PanelCard>
  {/snippet}
</TwoColumnPage>
