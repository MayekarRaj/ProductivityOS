<!--
  Pomodoro timer component.

  State machine:
    idle (work) → running (work) → idle (break, auto-switched) → running (break) → idle (work)

  On work session complete:
    - submits the incrementPomodoro form action (saves to DB)
    - auto-switches to break mode

  SVG ring:
    - stroke-dasharray  = full circumference (constant)
    - stroke-dashoffset = circumference × (1 - progress)
    - progress = timeLeft / totalTime (0 = empty ring, 1 = full ring)
    - rotate(-90deg) so ring starts at the top
-->

<script lang="ts">
	import { enhance } from '$app/forms';

	interface Task {
		id: string;
		text: string;
		area: string | null;
	}

	interface Props {
		dayId: string;
		sessions: number; // current pomodoro count for today (from DB)
		tasks?: Task[];   // today's pending tasks for optional linking
	}

	let { dayId, sessions = $bindable(), tasks = [] }: Props = $props();

	// Which task is currently linked to this session (null = no specific task)
	let selectedTaskId = $state<string | null>(null);

	// ── Constants ──────────────────────────────────────────────────────────────
	const WORK_SECS = 25 * 60; // 1500
	const BREAK_SECS = 5 * 60; // 300
	const RADIUS = 45;
	const CIRC = 2 * Math.PI * RADIUS; // ~282.7

	// ── Timer state ────────────────────────────────────────────────────────────
	let mode = $state<'work' | 'break'>('work');
	let running = $state(false);
	let timeLeft = $state(WORK_SECS);
	let intervalId = $state<ReturnType<typeof setInterval> | null>(null);

	// Hidden form reference — submitted programmatically when a work session ends
	let incrementForm = $state<HTMLFormElement | null>(null);

	// ── Derived display values ─────────────────────────────────────────────────
	const totalTime = $derived(mode === 'work' ? WORK_SECS : BREAK_SECS);
	const progress = $derived(timeLeft / totalTime); // 1 = full, 0 = empty
	const dashOffset = $derived(CIRC * (1 - progress));

	const minutes = $derived(Math.floor(timeLeft / 60));
	const seconds = $derived(timeLeft % 60);
	const timeDisplay = $derived(
		`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
	);

	// Ring color changes by mode
	const ringColor = $derived(mode === 'work' ? '#ef4444' : '#22c55e'); // red-500 / green-500

	// ── Controls ───────────────────────────────────────────────────────────────
	function startPause() {
		if (running) {
			// Pause: clear interval
			if (intervalId) clearInterval(intervalId);
			intervalId = null;
			running = false;
		} else {
			// Start: tick every second
			running = true;
			intervalId = setInterval(tick, 1000);
		}
	}

	function reset() {
		if (intervalId) clearInterval(intervalId);
		intervalId = null;
		running = false;
		timeLeft = mode === 'work' ? WORK_SECS : BREAK_SECS;
	}

	function tick() {
		timeLeft--;

		if (timeLeft <= 0) {
			// Session complete — stop timer
			if (intervalId) clearInterval(intervalId);
			intervalId = null;
			running = false;
			timeLeft = 0;

			if (mode === 'work') {
				// Increment DB counter
				sessions++;
				incrementForm?.requestSubmit();
				// Switch to break
				mode = 'break';
				timeLeft = BREAK_SECS;
			} else {
				// Break done — switch back to work
				mode = 'work';
				timeLeft = WORK_SECS;
			}
		}
	}

	// Clean up interval if component is destroyed (e.g. navigating away)
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});
</script>

<!-- Hidden form — submitted programmatically when a work session finishes -->
<form
	bind:this={incrementForm}
	method="POST"
	action="?/incrementPomodoro"
	use:enhance
	class="hidden"
>
	<input type="hidden" name="dayId" value={dayId} />
	<!-- current is read at submit time, so we derive it from sessions - 1 because we already incremented locally -->
	<input type="hidden" name="current" value={String(sessions - 1)} />
	<!-- taskId is null-safe — empty string means no task linked -->
	<input type="hidden" name="taskId" value={selectedTaskId ?? ''} />
</form>

<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
	<!-- Header row -->
	<div class="mb-4 flex items-center justify-between">
		<div>
			<p class="font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
				Pomodoro
			</p>
			<p class="font-mono text-sm text-[#e2e2e8]">
				{sessions}
				{sessions === 1 ? 'session' : 'sessions'} today
			</p>
		</div>
		<!-- Mode badge -->
		<span
			class="rounded-full px-3 py-1 font-mono text-xs font-semibold
			{mode === 'work'
				? 'bg-red-500/10 text-red-400'
				: 'bg-green-500/10 text-green-400'}"
		>
			{mode === 'work' ? '🍅 Work' : '☕ Break'}
		</span>
	</div>

	<!-- Task selector — only shown in work mode, optional -->
	{#if mode === 'work' && tasks.length > 0}
		<div class="mb-3">
			<select
				bind:value={selectedTaskId}
				class="w-full rounded border border-[#1e1e2e] bg-[#0c0c0f] px-2 py-1.5
				       font-mono text-xs text-[#e2e2e8] outline-none focus:border-[#2a2a3e]"
			>
				<option value={null}>No task linked</option>
				{#each tasks as task}
					<option value={task.id}>{task.text}</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- SVG ring + time display -->
	<div class="flex items-center justify-center py-2">
		<div class="relative">
			<svg width="140" height="140" viewBox="0 0 120 120" class="-rotate-90">
				<!-- Background track -->
				<circle
					cx="60"
					cy="60"
					r={RADIUS}
					fill="none"
					stroke="#1e1e2e"
					stroke-width="7"
				/>
				<!-- Progress ring -->
				<circle
					cx="60"
					cy="60"
					r={RADIUS}
					fill="none"
					stroke={ringColor}
					stroke-width="7"
					stroke-linecap="round"
					stroke-dasharray={CIRC}
					stroke-dashoffset={dashOffset}
					style="transition: stroke-dashoffset 0.5s linear, stroke 0.3s ease"
				/>
			</svg>

			<!-- Time display overlaid on the ring -->
			<div class="absolute inset-0 flex flex-col items-center justify-center">
				<span class="font-mono text-2xl font-bold tabular-nums text-[#e2e2e8]">
					{timeDisplay}
				</span>
			</div>
		</div>
	</div>

	<!-- Controls -->
	<div class="mt-4 flex items-center justify-center gap-3">
		<button
			onclick={startPause}
			class="min-w-[80px] rounded-lg px-4 py-2 font-mono text-sm font-semibold transition-colors
				{running
				? 'bg-[#1e1e2e] text-[#e2e2e8] hover:bg-[#2a2a3e]'
				: mode === 'work'
					? 'bg-red-500 text-white hover:bg-red-400'
					: 'bg-green-500 text-white hover:bg-green-400'}"
		>
			{running ? 'Pause' : 'Start'}
		</button>
		<button
			onclick={reset}
			class="rounded-lg border border-[#1e1e2e] px-4 py-2 font-mono text-sm text-[#6b6b7a]
				transition-colors hover:border-[#2a2a3e] hover:text-[#e2e2e8]"
		>
			Reset
		</button>
	</div>
</div>
