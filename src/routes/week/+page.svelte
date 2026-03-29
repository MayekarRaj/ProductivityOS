<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { areaFor as areaForHelper, colorClasses } from '$lib/constants/areas';
	import { formatTimeIST } from '$lib/utils/dates';

	let { data }: { data: PageData } = $props();

	// Which day card is currently expanded (shows task/event detail panel).
	// Only one day can be open at a time — clicking the same card collapses it.
	let expandedDate = $state<string | null>(null);

	// Short day label for each column header: "Mon", "Tue", etc.
	const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	// Energy emoji map — same as Today view
	const ENERGY_EMOJI: Record<string, string> = {
		drained: '😴',
		okay: '🙂',
		charged: '⚡',
		peak: '🔥'
	};

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

<div class="space-y-8">
	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<div>
		<p class="font-mono text-sm text-[#6b6b7a]">Week of</p>
		<h1 class="font-display text-2xl font-bold text-[#e2e2e8]">
			{shortDate(data.weekDates[0])} – {shortDate(data.weekDates[6])}
		</h1>
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
				{@const areaColors = area ? colorClasses(area.color) : null}
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
					<!-- Day name + date -->
					<div>
						<p
							class="font-mono text-xs font-semibold {isToday
								? 'text-[#e2e2e8]'
								: 'text-[#6b6b7a]'}"
						>
							{DAY_LABELS[i]}
						</p>
						<p class="font-mono text-sm {isToday ? 'text-white' : 'text-[#e2e2e8]'}">
							{shortDate(date)}
						</p>
						{#if isToday}
							<span class="mt-0.5 inline-block font-mono text-[10px] text-[#6b6b7a]">today</span>
						{/if}
					</div>

					<!-- Home base badge -->
					{#if area}
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px]
								{areaColors?.bg} {areaColors?.text}"
						>
							{area.emoji}
							{area.label}
						</span>
					{:else}
						<span class="font-mono text-[10px] text-[#6b6b7a]">–</span>
					{/if}

					<!-- Stats -->
					<div class="flex flex-col gap-0.5">
						{#if entry.tasks.length > 0}
							<p class="font-mono text-[10px] text-[#6b6b7a]">
								{#if pendingCount === 0}
									✓ {doneCount} done
								{:else}
									{pendingCount} left
									{#if doneCount > 0}/ {doneCount} done{/if}
								{/if}
							</p>
						{/if}
						{#if entry.day?.mvdDone}
							<p class="font-mono text-[10px] text-green-400">MVD ✓</p>
						{/if}
						{#if entry.day?.energy}
							<p class="font-mono text-[10px]">{ENERGY_EMOJI[entry.day.energy] ?? ''}</p>
						{/if}
						{#if entry.events.length > 0}
							<p class="font-mono text-[10px] text-[#6b6b7a]">
								{entry.events.length} event{entry.events.length > 1 ? 's' : ''}
							</p>
						{/if}
					</div>
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

				<!-- Events -->
				<div>
					<p
						class="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]"
					>
						Events
					</p>
					{#if entry.events.length === 0}
						<p class="font-mono text-xs text-[#6b6b7a]">No events</p>
					{:else}
						<ul class="space-y-1.5">
							{#each entry.events as event}
								<li class="flex items-center gap-2">
									<span class="font-mono text-[10px] tabular-nums text-[#6b6b7a]">
										{formatTimeIST(event.startsAt)}
									</span>
									<span class="flex-1 font-mono text-xs text-[#e2e2e8]">{event.title}</span>
									{#if event.area}
										{@const ea = areaFor(event.area)}
										{#if ea}
											<span class="shrink-0 font-mono text-[10px] {colorClasses(ea.color).text}"
												>{ea.emoji}</span
											>
										{/if}
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
</div>
