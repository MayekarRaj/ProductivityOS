<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { areaFor as areaForHelper, colorClasses } from '$lib/constants/areas';
	import { formatTimeIST } from '$lib/utils/dates';
	import TwoColumnPage from '$lib/components/TwoColumnPage.svelte';
	import PanelCard from '$lib/components/PanelCard.svelte';

	let { data }: { data: PageData } = $props();

	// Which day card is currently expanded (shows task/event detail panel).
	// Only one day can be open at a time — clicking the same card collapses it.
	let expandedDate = $state<string | null>(null);

	// Short day label for each column header: "Mon", "Tue", etc.
	const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	// Energy dot color map for day cards
	const ENERGY_DOT: Record<string, string> = {
		drained: 'bg-slate-500',
		okay:    'bg-yellow-400',
		charged: 'bg-blue-400',
		peak:    'bg-green-400'
	};

	const ENERGY_LABEL: Record<string, string> = {
		drained: 'Low',
		okay:    'Mid',
		charged: 'High',
		peak:    'Peak'
	};

	// Week navigation helpers
	function getAdjacentMonday(currentMonday: string, offset: number): string {
		const d = new Date(currentMonday + 'T00:00:00+05:30');
		d.setDate(d.getDate() + offset * 7);
		return d.toISOString().slice(0, 10);
	}

	function navToWeek(monday: string) {
		goto(`?week=${monday}`);
	}

	// Derived: week-level efficiency metrics for the right panel
	const totalPomodoros = $derived(
		Object.values(data.dayMap).reduce((s, e) => s + (e.day?.pomodoroSessions ?? 0), 0)
	);
	const focusHours = $derived(Math.round(totalPomodoros * 25 / 60 * 10) / 10);

	const totalTasks = $derived(
		Object.values(data.dayMap).reduce((s, e) => s + e.tasks.length, 0)
	);
	const pendingTasks = $derived(
		Object.values(data.dayMap).reduce((s, e) => s + e.tasks.filter(t => !t.done).length, 0)
	);
	const cognitiveLoad = $derived(
		totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0
	);

	// Quick log / braindump state
	let quickLogText = $state('');
	let braindumpText = $state('');
	let showQuickLog = $state(false);
	let showBraindump = $state(false);

	function toggleExpand(date: string) {
		expandedDate = expandedDate === date ? null : date;
	}

	// Derive the area object for a homeBase key — looks up in data.areas from layout
	function areaFor(key: string | null | undefined) {
		return areaForHelper(key, data.areas);
	}

	// Format YYYY-MM-DD as short "Mar 23"
	function shortDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00+05:30');
		return new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Kolkata',
			month: 'short',
			day: 'numeric'
		}).format(d);
	}

	// Sunday review local state — initialised from loaded data
	let reviewImportant = $state(data.sundayReview?.importantThings ?? '');
	let reviewDeadlines = $state(data.sundayReview?.deadlineShifts ?? '');
	let reviewFitness = $state(data.sundayReview?.fitnessPlan ?? '');
	let reviewSaved = $state(false);
	let draftGenerating = $state(false);
	let draftError = $state('');
</script>

<TwoColumnPage>
  {#snippet main()}
	<!-- ── Header ── -->
	<div class="flex items-start justify-between">
	  <div>
	    <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b7a]">
	      Operational Cycle
	    </p>
	    <h1 class="font-display text-2xl font-bold text-[#e2e2e8]">
	      {shortDate(data.weekDates[0])} — {shortDate(data.weekDates[6])}
	    </h1>
	  </div>
	  <!-- Week navigation -->
	  <div class="flex items-center gap-1">
	    <button
	      onclick={() => navToWeek(getAdjacentMonday(data.weekStartDate, -1))}
	      class="flex h-7 w-7 items-center justify-center rounded font-mono text-sm
	             text-[#6b6b7a] transition-colors hover:bg-[#1e1e2e] hover:text-[#e2e2e8]"
	      aria-label="Previous week"
	    >‹</button>
	    {#if !data.isCurrentWeek}
	      <button
	        onclick={() => goto('/week')}
	        class="rounded border border-[#2a2a3e] px-2.5 py-1 font-mono text-[10px]
	               uppercase tracking-widest text-[#6b6b7a] transition-colors
	               hover:border-violet-500/40 hover:text-violet-400"
	      >Current</button>
	    {:else}
	      <span class="rounded border border-violet-500/30 px-2.5 py-1 font-mono text-[10px]
	                   uppercase tracking-widest text-violet-400">Current</span>
	    {/if}
	    <button
	      onclick={() => navToWeek(getAdjacentMonday(data.weekStartDate, 1))}
	      class="flex h-7 w-7 items-center justify-center rounded font-mono text-sm
	             text-[#6b6b7a] transition-colors hover:bg-[#1e1e2e] hover:text-[#e2e2e8]"
	      aria-label="Next week"
	    >›</button>
	  </div>
	</div>

	<!-- ── 7-Day Grid ───────────────────────────────────────────────────────── -->
	<!--
		Each day card is clickable — clicking expands an inline detail panel below.
		The grid overflows horizontally on mobile (min-w prevents cards from being too narrow).
	-->
	<div class="overflow-x-auto pb-2">
		<div class="grid min-w-[560px] grid-cols-7 gap-2">
			{#each data.weekDates as date, i}
				{@const entry = data.dayMap[date]}
				{@const isToday = date === data.todayStr}
				{@const area = areaFor(entry.day?.homeBase)}
				{@const pendingCount = entry.tasks.filter((t) => !t.done).length}
				{@const doneCount = entry.tasks.filter((t) => t.done).length}
				{@const isExpanded = expandedDate === date}

				<button
					onclick={() => toggleExpand(date)}
					class="flex flex-col gap-2 rounded-xl border p-3 text-left transition-all
						{isToday
						? 'border-[#e2e2e8]/20 bg-[#1e1e2e]'
						: 'border-[#1e1e2e] bg-[#161620] hover:border-[#2a2a3e]'}
						{isExpanded ? 'ring-1 ring-white/10' : ''}"
				>
					<!-- Day abbrev top-left, area emoji top-right -->
					<div class="flex items-start justify-between">
					  <div>
					    <p class="font-mono text-[10px] font-semibold uppercase text-[#6b6b7a]">{DAY_LABELS[i]}</p>
					    <p class="font-mono text-lg font-bold leading-tight {isToday ? 'text-white' : 'text-[#e2e2e8]'}">
					      {new Date(date + 'T00:00:00+05:30').getDate()}
					    </p>
					  </div>
					  {#if area}
					    <span class="text-base" title={area.label}>{area.emoji}</span>
					  {/if}
					</div>

					<!-- Energy dot + label -->
					{#if entry.day?.energy}
					  <div class="flex items-center gap-1">
					    <span class="h-1.5 w-1.5 rounded-full {ENERGY_DOT[entry.day.energy] ?? 'bg-[#3a3a4e]'}"></span>
					    <span class="font-mono text-[9px] uppercase tracking-wide text-[#6b6b7a]">
					      {ENERGY_LABEL[entry.day.energy] ?? ''}
					    </span>
					  </div>
					{:else}
					  <div class="h-4"></div>
					{/if}

					<!-- Task count -->
					{#if entry.tasks.length > 0}
					  <p class="font-mono text-[10px] text-[#6b6b7a]">
					    {pendingCount > 0 ? `${pendingCount} left` : `✓ ${doneCount}`}
					  </p>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- ── Expanded Day Panel ───────────────────────────────────────────────── -->
	<!--
		Appears below the grid when a day card is clicked.
		Shows tasks, events, home base picker, and note for that day.
	-->
	{#if expandedDate}
		{@const entry = data.dayMap[expandedDate]}
		{@const pendingTasks = entry.tasks.filter((t) => !t.done)}
		{@const doneTasks = entry.tasks.filter((t) => t.done)}

		<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
			<!-- Panel header: full date + home base dropdown -->
			<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
				<h2 class="font-display text-base font-semibold text-[#e2e2e8]">
					{new Intl.DateTimeFormat('en-US', {
						timeZone: 'Asia/Kolkata',
						weekday: 'long',
						month: 'long',
						day: 'numeric'
					}).format(new Date(expandedDate + 'T00:00:00+05:30'))}
				</h2>

				<!-- Home base picker — submits on change, triggers load() refresh via use:enhance -->
				<form method="POST" action="?/setHomeBase" use:enhance class="flex items-center gap-2">
					<input type="hidden" name="date" value={expandedDate} />
					<label class="font-mono text-xs text-[#6b6b7a]">Home base</label>
					<select
						name="homeBase"
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
						class="rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-1.5
							font-mono text-xs text-[#e2e2e8] focus:outline-none focus:ring-1 focus:ring-white/20"
						value={entry.day?.homeBase ?? 'getfly'}
					>
						{#each data.areas.filter(a => !a.suspended) as a}
							<option value={a.key}>{a.emoji} {a.label}</option>
						{/each}
					</select>
				</form>
			</div>

			<div class="grid gap-6 sm:grid-cols-2">
				<!-- Tasks -->
				<div>
					<p
						class="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]"
					>
						Tasks
					</p>
					{#if entry.tasks.length === 0}
						<p class="font-mono text-xs text-[#6b6b7a]">No tasks</p>
					{:else}
						<ul class="space-y-1.5">
							{#each pendingTasks as task}
								<li class="flex items-start gap-2">
									<span class="mt-0.5 font-mono text-xs text-[#6b6b7a]">○</span>
									<span class="flex-1 font-mono text-xs text-[#e2e2e8]">{task.text}</span>
									{#if task.area}
										{@const ta = areaFor(task.area)}
										{#if ta}
											<span class="shrink-0 font-mono text-[10px] {colorClasses(ta.color).text}"
												>{ta.emoji}</span
											>
										{/if}
									{/if}
								</li>
							{/each}
							{#each doneTasks as task}
								<li class="flex items-start gap-2 opacity-50">
									<span class="mt-0.5 font-mono text-xs text-green-400">✓</span>
									<span class="flex-1 font-mono text-xs text-[#e2e2e8] line-through"
										>{task.text}</span
									>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<!-- Focus Schedule -->
				<div>
				  <p class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b7a]">
				    Focus Schedule
				  </p>
				  {#if entry.events.length === 0}
				    <p class="font-mono text-xs text-[#3a3a4e]">No events</p>
				  {:else}
				    <ul class="space-y-1.5">
				      {#each entry.events as event}
				        {@const ea = event.area ? areaFor(event.area) : null}
				        {@const eaColors = ea ? colorClasses(ea.color) : null}
				        <li class="flex items-center gap-2.5 rounded-r-lg border-l-2 pl-3 py-1.5
				                   {eaColors ? eaColors.border : 'border-[#3a3a4e]'}">
				          <span class="font-mono text-[10px] tabular-nums text-[#6b6b7a]">
				            {formatTimeIST(event.startsAt)}
				          </span>
				          <span class="flex-1 font-mono text-xs text-[#e2e2e8]">{event.title}</span>
				          {#if ea}
				            <span class="font-mono text-[9px] uppercase {eaColors?.text}">{ea.label}</span>
				          {/if}
				        </li>
				      {/each}
				    </ul>
				  {/if}
				</div>
			</div>

			<!-- Note -->
			{#if entry.day?.note}
				<div class="mt-5 border-t border-[#1e1e2e] pt-5">
					<p
						class="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]"
					>
						Note
					</p>
					<p class="font-mono text-xs leading-relaxed text-[#e2e2e8]">{entry.day.note}</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── Sunday Review ────────────────────────────────────────────────────── -->
	<!--
		Three reflection prompts. Autosaves on blur (clicking away from a textarea).
		weekStartDate = Monday of this week — uniquely identifies the review row.
	-->
	<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
		<div class="mb-4 flex items-center justify-between gap-4">
			<div>
				<h2 class="font-display text-base font-semibold text-[#e2e2e8]">Sunday Review</h2>
				<p class="font-mono text-xs text-[#6b6b7a]">Reflect on the week — autosaves on blur</p>
			</div>
			<div class="flex items-center gap-3">
				{#if reviewSaved}
					<span class="font-mono text-xs text-green-400">Saved ✓</span>
				{/if}
				<!-- 9.4: AI draft generation -->
				<form
					method="POST"
					action="?/generateSundayDraft"
					use:enhance={() => {
						draftGenerating = true;
						draftError = '';
						return async ({ result, update }) => {
							await update({ reset: false });
							draftGenerating = false;
							if (result.type === 'success' && result.data?.draft) {
								const d = result.data.draft as { importantThings: string; deadlineShifts: string; fitnessPlan: string };
								reviewImportant = d.importantThings;
								reviewDeadlines = d.deadlineShifts;
								reviewFitness = d.fitnessPlan;
							} else if (result.type === 'success' && result.data?.draftError) {
								draftError = result.data.draftError as string;
							}
						};
					}}
				>
					<button
						type="submit"
						disabled={draftGenerating}
						class="rounded-lg border border-[#1e1e2e] px-3 py-1.5 font-mono text-xs
							text-[#6b6b7a] transition-colors hover:border-[#2a2a3e] hover:text-[#e2e2e8]
							disabled:opacity-40"
					>
						{draftGenerating ? 'Generating…' : '✦ AI draft'}
					</button>
				</form>
			</div>
		</div>
		{#if draftError}
			<p class="mb-3 font-mono text-xs text-red-400">{draftError}</p>
		{/if}

		<form
			method="POST"
			action="?/saveSundayReview"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					reviewSaved = true;
					setTimeout(() => (reviewSaved = false), 2000);
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="weekStartDate" value={data.weekStartDate} />

			<div>
				<label class="mb-1 block font-mono text-xs font-semibold text-[#6b6b7a]">
					What were the most important things you did this week?
				</label>
				<textarea
					name="importantThings"
					rows="3"
					bind:value={reviewImportant}
					onblur={(e) => e.currentTarget.form?.requestSubmit()}
					placeholder="Key wins, progress, moments that mattered…"
					class="w-full resize-none rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
						font-mono text-xs leading-relaxed text-[#e2e2e8] placeholder-[#3a3a4e]
						focus:border-[#2a2a3e] focus:outline-none focus:ring-1 focus:ring-white/10"
				></textarea>
			</div>

			<div>
				<label class="mb-1 block font-mono text-xs font-semibold text-[#6b6b7a]">
					What shifted or got delayed?
				</label>
				<textarea
					name="deadlineShifts"
					rows="3"
					bind:value={reviewDeadlines}
					onblur={(e) => e.currentTarget.form?.requestSubmit()}
					placeholder="Missed deadlines, reprioritizations, blockers…"
					class="w-full resize-none rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
						font-mono text-xs leading-relaxed text-[#e2e2e8] placeholder-[#3a3a4e]
						focus:border-[#2a2a3e] focus:outline-none focus:ring-1 focus:ring-white/10"
				></textarea>
			</div>

			<div>
				<label class="mb-1 block font-mono text-xs font-semibold text-[#6b6b7a]">
					What's your fitness plan for next week?
				</label>
				<textarea
					name="fitnessPlan"
					rows="2"
					bind:value={reviewFitness}
					onblur={(e) => e.currentTarget.form?.requestSubmit()}
					placeholder="Workouts, sleep target, nutrition focus…"
					class="w-full resize-none rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
						font-mono text-xs leading-relaxed text-[#e2e2e8] placeholder-[#3a3a4e]
						focus:border-[#2a2a3e] focus:outline-none focus:ring-1 focus:ring-white/10"
				></textarea>
			</div>
		</form>
	</div>
  {/snippet}

  {#snippet panel()}
    <!-- ── Efficiency Metrics ── -->
    <PanelCard title="Efficiency Metrics">
      <div class="space-y-3">
        <!-- Cognitive Load -->
        <div>
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-[#6b6b7a]">Cognitive Load</span>
            <span class="font-mono text-sm font-semibold text-[#e2e2e8]">{cognitiveLoad}%</span>
          </div>
          <div class="mt-1.5 h-1 w-full rounded-full bg-[#1e1e2e]">
            <div
              class="h-full rounded-full transition-all
                     {cognitiveLoad > 75 ? 'bg-red-400' : cognitiveLoad > 40 ? 'bg-yellow-400' : 'bg-green-400'}"
              style="width: {cognitiveLoad}%"
            ></div>
          </div>
        </div>
        <!-- Focus Time -->
        <div class="flex items-center justify-between rounded-lg bg-[#0c0c0f] px-3 py-2">
          <span class="font-mono text-[10px] uppercase tracking-wider text-[#6b6b7a]">Focus Time</span>
          <span class="font-mono text-sm font-bold text-[#e2e2e8]">{focusHours}h</span>
        </div>
        <!-- Pending Tasks -->
        <div class="flex items-center justify-between rounded-lg bg-[#0c0c0f] px-3 py-2">
          <span class="font-mono text-[10px] uppercase tracking-wider text-[#6b6b7a]">Pending Tasks</span>
          <span class="font-mono text-sm font-bold text-[#e2e2e8]">{pendingTasks}</span>
        </div>
      </div>
    </PanelCard>

    <!-- ── Quick Log ── -->
    <PanelCard>
      {#if !showQuickLog}
        <button
          onclick={() => (showQuickLog = true)}
          class="flex w-full items-center gap-2 font-mono text-xs text-[#6b6b7a]
                 transition-colors hover:text-[#e2e2e8]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2V10M2 6H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Quick Log
        </button>
      {:else}
        <form
          method="POST"
          action="?/addInboxItem"
          use:enhance={() => {
            return async ({ update }) => {
              await update();
              quickLogText = '';
              showQuickLog = false;
            };
          }}
          class="flex items-center gap-2"
        >
          <input
            bind:value={quickLogText}
            name="text"
            placeholder="Log something..."
            autofocus
            class="flex-1 bg-transparent font-mono text-xs text-[#e2e2e8] placeholder-[#3a3a4e] outline-none"
          />
          <button type="submit" class="font-mono text-[10px] text-violet-400 hover:text-violet-300">↵</button>
          <button type="button" onclick={() => (showQuickLog = false)}
                  class="font-mono text-[10px] text-[#3a3a4e] hover:text-[#6b6b7a]">✕</button>
        </form>
      {/if}
    </PanelCard>

    <!-- ── Braindump ── -->
    <PanelCard>
      {#if !showBraindump}
        <button
          onclick={() => (showBraindump = true)}
          class="flex w-full items-center gap-2 font-mono text-xs text-[#6b6b7a]
                 transition-colors hover:text-[#e2e2e8]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/>
            <path d="M4 6C4 6 4.5 8 6 8C7.5 8 8 6 8 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="4.5" cy="4.5" r="0.5" fill="currentColor"/>
            <circle cx="7.5" cy="4.5" r="0.5" fill="currentColor"/>
          </svg>
          Braindump
        </button>
      {:else}
        <form
          method="POST"
          action="?/addInboxItem"
          use:enhance={() => {
            return async ({ update }) => {
              await update();
              braindumpText = '';
              showBraindump = false;
            };
          }}
          class="flex items-center gap-2"
        >
          <input
            bind:value={braindumpText}
            name="text"
            placeholder="What's on your mind..."
            autofocus
            class="flex-1 bg-transparent font-mono text-xs text-[#e2e2e8] placeholder-[#3a3a4e] outline-none"
          />
          <button type="submit" class="font-mono text-[10px] text-violet-400 hover:text-violet-300">↵</button>
          <button type="button" onclick={() => (showBraindump = false)}
                  class="font-mono text-[10px] text-[#3a3a4e] hover:text-[#6b6b7a]">✕</button>
        </form>
      {/if}
    </PanelCard>

    <!-- ── System Note (placeholder — AI endpoint skipped for now) ── -->
    <PanelCard>
      <div class="flex items-start gap-2">
        <span class="font-mono text-[10px] text-[#3a3a4e]">≡</span>
        <p class="font-mono text-xs italic leading-relaxed text-[#3a3a4e]">
          System note will appear here once the week has data.
        </p>
      </div>
    </PanelCard>
  {/snippet}
</TwoColumnPage>
