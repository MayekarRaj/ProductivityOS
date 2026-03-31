<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { COLOR_OPTIONS, colorClasses } from '$lib/constants/areas';
	import TwoColumnPage from '$lib/components/TwoColumnPage.svelte';
	import PanelCard from '$lib/components/PanelCard.svelte';

	let { data }: { data: PageData } = $props();

	// Active areas (shown at top), suspended ones (shown below)
	const activeAreas = $derived(data.areas.filter((a) => !a.suspended));
	const suspendedAreas = $derived(data.areas.filter((a) => a.suspended));

	// ── Add form state ────────────────────────────────────────────────────────
	let showAdd = $state(false);
	let newLabel = $state('');
	let newEmoji = $state('📌');
	let newColor = $state('purple');

	// ── Edit state — one area can be in edit mode at a time ──────────────────
	let editingId = $state<string | null>(null);
	let editLabel = $state('');
	let editEmoji = $state('');
	let editColor = $state('');

	function startEdit(area: (typeof data.areas)[0]) {
		editingId = area.id;
		editLabel = area.label;
		editEmoji = area.emoji;
		editColor = area.color;
	}

	// ── Delete error state ────────────────────────────────────────────────────
	let deleteErrors = $state<Record<string, string>>({});

	// ── Schedule state (from user preferences via layout) ────────────────────
	let workdayStart = $state(data.user?.workdayStart ?? '09:00');
	let workdayEnd = $state(data.user?.workdayEnd ?? '18:00');
	let autoFocusMode = $state(data.user?.autoFocusMode ?? false);
	let weekendThreshold = $state(data.user?.weekendThreshold ?? '14:00');

	// ── Color → hex map for swatch display ───────────────────────────────────
	const COLOR_HEX: Record<string, string> = {
		blue: '#60a5fa', purple: '#c084fc', green: '#4ade80', orange: '#fb923c',
		rose: '#fb7185', amber: '#fbbf24', teal: '#2dd4bf', pink: '#f472b6',
		red: '#f87171', indigo: '#818cf8'
	};
</script>

<TwoColumnPage>
  {#snippet main()}
	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="font-display text-2xl font-bold text-[#e2e2e8]">Settings</h1>
			<p class="font-mono text-[10px] text-[#6b6b7a]">Configuration // System Identity</p>
		</div>
		<button
			onclick={() => (showAdd = !showAdd)}
			class="rounded border border-[#2a2a3e] px-3 py-1.5 font-mono text-[10px] uppercase
				tracking-widest text-[#6b6b7a] transition-colors hover:border-violet-500/40
				hover:text-violet-400"
		>
			{showAdd ? 'Cancel' : '+ Add Context'}
		</button>
	</div>

	<!-- ── Add area form ──────────────────────────────────────────────────────── -->
	{#if showAdd}
		<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
			<h2 class="mb-4 font-display text-sm font-semibold text-[#e2e2e8]">New area</h2>
			<form
				method="POST"
				action="?/addArea"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type !== 'failure') {
							newLabel = '';
							newEmoji = '📌';
							newColor = 'purple';
							showAdd = false;
						}
					};
				}}
				class="space-y-4"
			>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="mb-1 block font-mono text-xs text-[#6b6b7a]">Label</label>
						<input
							type="text"
							name="label"
							bind:value={newLabel}
							required
							placeholder="e.g. Consulting"
							class="w-full rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
								font-mono text-sm text-[#e2e2e8] placeholder-[#3a3a4e]
								focus:outline-none focus:ring-1 focus:ring-white/20"
						/>
					</div>
					<div>
						<label class="mb-1 block font-mono text-xs text-[#6b6b7a]">Emoji</label>
						<input
							type="text"
							name="emoji"
							bind:value={newEmoji}
							placeholder="📌"
							class="w-full rounded-lg border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
								font-mono text-sm text-[#e2e2e8] placeholder-[#3a3a4e]
								focus:outline-none focus:ring-1 focus:ring-white/20"
						/>
					</div>
				</div>

				<!-- Color palette -->
				<div>
					<label class="mb-2 block font-mono text-xs text-[#6b6b7a]">Color</label>
					<div class="flex flex-wrap gap-2">
						{#each COLOR_OPTIONS as c}
							<label class="cursor-pointer">
								<input type="radio" name="color" value={c.key} bind:group={newColor} class="sr-only" />
								<span
									class="flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all
										{newColor === c.key ? 'border-white scale-110' : 'border-transparent'}
										{c.bg}"
									title={c.label}
								>
									<span class="h-3 w-3 rounded-full {c.text.replace('text-', 'bg-').replace('-400', '-400')}
										bg-current"></span>
								</span>
							</label>
						{/each}
					</div>
				</div>

				<button
					type="submit"
					class="rounded-lg bg-white px-4 py-2 font-mono text-xs font-semibold
						text-[#0c0c0f] transition-opacity hover:opacity-90"
				>
					Add area
				</button>
			</form>
		</div>
	{/if}

	<!-- ── Active areas ───────────────────────────────────────────────────────── -->
	<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
		<p class="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
			Active ({activeAreas.length})
		</p>

		{#if activeAreas.length === 0}
			<p class="font-mono text-xs text-[#6b6b7a]">No active areas</p>
		{:else}
			<ul class="space-y-3">
				{#each activeAreas as area}
					{@const colors = colorClasses(area.color)}

					<li class="flex flex-col gap-2">
						{#if editingId === area.id}
							<!-- Edit mode -->
							<form
								method="POST"
								action="?/updateArea"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
										editingId = null;
									};
								}}
								class="space-y-3 rounded-lg border border-[#2a2a3e] bg-[#0c0c0f] p-3"
							>
								<input type="hidden" name="id" value={area.id} />
								<div class="grid grid-cols-2 gap-3">
									<input
										type="text"
										name="label"
										bind:value={editLabel}
										required
										class="rounded-lg border border-[#1e1e2e] bg-[#161620] px-3 py-1.5
											font-mono text-sm text-[#e2e2e8] focus:outline-none focus:ring-1 focus:ring-white/20"
									/>
									<input
										type="text"
										name="emoji"
										bind:value={editEmoji}
										class="rounded-lg border border-[#1e1e2e] bg-[#161620] px-3 py-1.5
											font-mono text-sm text-[#e2e2e8] focus:outline-none focus:ring-1 focus:ring-white/20"
									/>
								</div>
								<div class="flex flex-wrap gap-2">
									{#each COLOR_OPTIONS as c}
										<label class="cursor-pointer">
											<input type="radio" name="color" value={c.key} bind:group={editColor} class="sr-only" />
											<span
												class="flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all
													{editColor === c.key ? 'border-white scale-110' : 'border-transparent'}
													{c.bg}"
											>
												<span class="h-2.5 w-2.5 rounded-full bg-current {c.text}"></span>
											</span>
										</label>
									{/each}
								</div>
								<div class="flex gap-2">
									<button type="submit" class="rounded-lg bg-white px-3 py-1 font-mono text-xs font-semibold text-[#0c0c0f]">Save</button>
									<button type="button" onclick={() => (editingId = null)} class="font-mono text-xs text-[#6b6b7a]">Cancel</button>
								</div>
							</form>
						{:else}
							<!-- Display mode — richer row -->
							<div class="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors
							            hover:bg-[#161620]">
								<!-- Drag handle (visual) -->
								<span class="shrink-0 cursor-grab text-[#2a2a3e] transition-colors hover:text-[#3a3a4e]"
								      style="font-size: 11px; line-height: 1;">⠿</span>

								<!-- Color swatch -->
								<span
									class="h-3 w-3 shrink-0 rounded-full"
									style="background: {COLOR_HEX[area.color] ?? '#c084fc'}"
								></span>

								<!-- Emoji + label -->
								<span class="font-mono text-sm">{area.emoji}</span>
								<div class="flex-1 min-w-0">
									<p class="font-mono text-xs text-[#e2e2e8]">{area.label}</p>
									<p class="font-mono text-[9px] text-[#3a3a4e]">{area.key}</p>
								</div>

								<!-- Active badge -->
								<span class="font-mono text-[9px] uppercase tracking-wider
								             {area.suspended ? 'text-[#3a3a4e]' : 'text-green-400/70'}">
									{area.suspended ? 'Suspended' : 'Active'}
								</span>

								<!-- Suspend/Unsuspend toggle -->
								<form method="POST"
								      action={area.suspended ? '?/unsuspendArea' : '?/suspendArea'}
								      use:enhance>
									<input type="hidden" name="id" value={area.id} />
									<!-- Toggle switch -->
									<button
										type="submit"
										class="relative h-4 w-7 rounded-full transition-colors
										       {area.suspended ? 'bg-[#2a2a3e]' : 'bg-violet-500/40'}"
										aria-label={area.suspended ? 'Activate' : 'Suspend'}
									>
										<span
											class="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all
											       {area.suspended ? 'left-0.5' : 'left-3.5'}"
										></span>
									</button>
								</form>

								<!-- Edit -->
								<button
									onclick={() => startEdit(area)}
									class="font-mono text-[10px] text-[#3a3a4e] transition-colors hover:text-[#6b6b7a]"
									aria-label="Edit area"
								>
									✎
								</button>

								<!-- Delete -->
								<form
									method="POST"
									action="?/deleteArea"
									use:enhance={() => {
										return async ({ result, update }) => {
											await update({ reset: false });
											if (result.type === 'failure' && result.data?.deleteError) {
												deleteErrors[area.id] = result.data.deleteError as string;
												setTimeout(() => delete deleteErrors[area.id], 5000);
											}
										};
									}}
								>
									<input type="hidden" name="id" value={area.id} />
									<input type="hidden" name="key" value={area.key} />
									<button type="submit"
									        class="font-mono text-[10px] text-[#3a3a4e] transition-colors hover:text-red-400"
									        aria-label="Delete area">
										✕
									</button>
								</form>
							</div>

							{#if deleteErrors[area.id]}
								<p class="pl-2 font-mono text-[10px] text-red-400">{deleteErrors[area.id]}</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- ── Suspended areas ────────────────────────────────────────────────────── -->
	{#if suspendedAreas.length > 0}
		<div class="rounded-xl border border-[#1e1e2e] bg-[#161620] p-5">
			<p class="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
				Suspended ({suspendedAreas.length})
			</p>
			<ul class="space-y-2">
				{#each suspendedAreas as area}
					{@const colors = colorClasses(area.color)}
					<li class="flex items-center gap-3 opacity-50">
						<span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs line-through {colors.bg} {colors.text}">
							{area.emoji} {area.label}
						</span>
						<span class="flex-1 font-mono text-[10px] text-[#3a3a4e]">{area.key}</span>

						<form method="POST" action="?/unsuspendArea" use:enhance>
							<input type="hidden" name="id" value={area.id} />
							<button type="submit" class="font-mono text-[10px] text-[#6b6b7a] transition-colors hover:text-green-400">
								Restore
							</button>
						</form>

						<form
							method="POST"
							action="?/deleteArea"
							use:enhance={() => {
								return async ({ result, update }) => {
									await update({ reset: false });
									if (result.type === 'failure' && result.data?.deleteError) {
										deleteErrors[area.id] = result.data.deleteError as string;
										setTimeout(() => delete deleteErrors[area.id], 5000);
									}
								};
							}}
						>
							<input type="hidden" name="id" value={area.id} />
							<input type="hidden" name="key" value={area.key} />
							<button type="submit" class="font-mono text-[10px] text-[#6b6b7a] transition-colors hover:text-red-400">
								Delete
							</button>
						</form>
					</li>
					{#if deleteErrors[area.id]}
						<li class="pl-2">
							<p class="font-mono text-[10px] text-red-400">{deleteErrors[area.id]}</p>
						</li>
					{/if}
				{/each}
			</ul>
		</div>
	{/if}
  {/snippet}

  {#snippet panel()}
    <!-- ── Default Schedule ── -->
    <PanelCard title="Default Schedule">
      <form
        method="POST"
        action="?/updateSchedule"
        use:enhance
        class="space-y-3"
      >
        <div>
          <label class="mb-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-[#6b6b7a]">
            Workday Start
          </label>
          <input
            type="time"
            name="workdayStart"
            bind:value={workdayStart}
            onblur={(e) => e.currentTarget.form?.requestSubmit()}
            class="w-full rounded border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
                   font-mono text-sm text-[#e2e2e8] outline-none focus:border-violet-500/50"
          />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-[#6b6b7a]">
            Workday End
          </label>
          <input
            type="time"
            name="workdayEnd"
            bind:value={workdayEnd}
            onblur={(e) => e.currentTarget.form?.requestSubmit()}
            class="w-full rounded border border-[#1e1e2e] bg-[#0c0c0f] px-3 py-2
                   font-mono text-sm text-[#e2e2e8] outline-none focus:border-violet-500/50"
          />
        </div>
      </form>
    </PanelCard>

    <!-- ── Preferences ── -->
    <PanelCard title="Preferences">
      <form method="POST" action="?/updatePreferences" use:enhance class="space-y-3">
        <input type="hidden" name="weekendThreshold" value={weekendThreshold} />
        <input type="hidden" name="autoFocusMode" value={String(autoFocusMode)} />

        <!-- Auto-Focus Mode toggle -->
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs text-[#c8c8d4]">Auto-Focus Mode</span>
          <button
            type="submit"
            onclick={() => { autoFocusMode = !autoFocusMode; }}
            class="relative h-4 w-7 rounded-full transition-colors
                   {autoFocusMode ? 'bg-violet-500/60' : 'bg-[#2a2a3e]'}"
          >
            <span
              class="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all
                     {autoFocusMode ? 'left-3.5' : 'left-0.5'}"
            ></span>
          </button>
        </div>

        <!-- Weekend Threshold -->
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs text-[#6b6b7a]">Weekend Threshold</span>
          <select
            bind:value={weekendThreshold}
            onchange={(e) => e.currentTarget.form?.requestSubmit()}
            name="weekendThreshold"
            class="rounded border border-[#1e1e2e] bg-[#0c0c0f] px-2 py-1
                   font-mono text-[10px] text-[#e2e2e8] outline-none"
          >
            <option value="12:00">Fri 12:00</option>
            <option value="14:00">Fri 14:00</option>
            <option value="16:00">Fri 16:00</option>
            <option value="18:00">Fri 18:00</option>
          </select>
        </div>
      </form>
    </PanelCard>

    <!-- ── Identity Logic ── -->
    <PanelCard>
      <div class="space-y-2">
        <div class="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="text-[#3a3a4e]">
            <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.2"/>
            <path d="M5 3V5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="5" cy="7" r="0.5" fill="currentColor"/>
          </svg>
          <span class="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#3a3a4e]">
            Identity Logic
          </span>
        </div>
        <p class="font-mono text-[10px] leading-relaxed text-[#3a3a4e]">
          Areas represent execution contexts for tasks and habits. Reordering them updates
          the priority weight in the cognitive engine's task algorithm.
        </p>
        <div class="flex gap-1.5 pt-1">
          <span class="rounded bg-[#1e1e2e] px-1.5 py-0.5 font-mono text-[9px] text-[#3a3a4e]">
            Context_v2.0
          </span>
          <span class="rounded bg-[#1e1e2e] px-1.5 py-0.5 font-mono text-[9px] text-[#3a3a4e]">
            Sync_Enabled
          </span>
        </div>
      </div>
    </PanelCard>
  {/snippet}
</TwoColumnPage>
