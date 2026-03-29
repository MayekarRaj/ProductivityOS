<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { COLOR_OPTIONS, colorClasses } from '$lib/constants/areas';

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
</script>

<div class="space-y-8">
	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="font-display text-2xl font-bold text-[#e2e2e8]">Settings</h1>
			<p class="font-mono text-sm text-[#6b6b7a]">Manage your areas</p>
		</div>
		<button
			onclick={() => (showAdd = !showAdd)}
			class="rounded-lg border border-[#1e1e2e] bg-[#161620] px-3 py-1.5 font-mono text-xs
				text-[#e2e2e8] transition-colors hover:border-[#2a2a3e]"
		>
			{showAdd ? 'Cancel' : '+ New area'}
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
							<!-- Display mode -->
							<div class="flex items-center gap-3">
								<span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs {colors.bg} {colors.text}">
									{area.emoji} {area.label}
								</span>
								<span class="flex-1 font-mono text-[10px] text-[#3a3a4e]">{area.key}</span>

								<!-- Actions -->
								<button
									onclick={() => startEdit(area)}
									class="font-mono text-[10px] text-[#6b6b7a] transition-colors hover:text-[#e2e2e8]"
								>
									Edit
								</button>

								<form method="POST" action="?/suspendArea" use:enhance>
									<input type="hidden" name="id" value={area.id} />
									<button type="submit" class="font-mono text-[10px] text-[#6b6b7a] transition-colors hover:text-yellow-400">
										Suspend
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
</div>
