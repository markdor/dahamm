<script lang="ts">
	import { enhance } from '$app/forms';
	import { QUICK_ADD_TARGETS, SHOPPING_ITEM_NAME_LENGTH } from '@dahamm/shared';

	// Globales Schnell-Hinzufügen auf dem Dashboard.
	// Ein Icon vor dem Eingabefeld zeigt das aktuell gewählte Ziel und öffnet
	// per Klick ein Dropdown zur Zieländerung (ändert nur den State, postet
	// nichts). Der „+"-Button (und Enter) postet direkt an das aktuell
	// gewählte Ziel.

	// Eingabe-Constraints aus der geteilten Domänen-Definition: mind. 3 Zeichen
	// (getrimmt), damit der „+"-Button aktiv wird; max. 64 Zeichen (auch hart per
	// maxlength am Input erzwungen).
	const { min: MIN_LENGTH, max: MAX_LENGTH } = SHOPPING_ITEM_NAME_LENGTH;

	let open = $state(false);
	let value = $state('');
	// Always defaults on mount, no persistence (e.g. via localStorage).
	let selectedTargetId = $state(QUICK_ADD_TARGETS[0].id);

	const selectedTarget = $derived(
		QUICK_ADD_TARGETS.find((t) => t.id === selectedTargetId) ?? QUICK_ADD_TARGETS[0]
	);
	const canAdd = $derived(value.trim().length >= MIN_LENGTH);
</script>

<form
	method="POST"
	action={selectedTarget.action}
	class="flex gap-2"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') value = '';
			// reset:false – wir leeren das Feld selbst; update() lädt die Daten neu,
			// damit die Karte den frischen Posten zeigt.
			await update({ reset: false });
		};
	}}
>
	<div class="relative">
		<button
			type="button"
			aria-haspopup="menu"
			aria-expanded={open}
			aria-label={`Ziel: ${selectedTarget.label} – ändern`}
			onclick={() => (open = !open)}
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
		>
			<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="9" cy="20" r="1.25" />
				<circle cx="18" cy="20" r="1.25" />
				<path
					d="M2.5 3h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>

		{#if open}
			<!-- Click-away backdrop -->
			<button
				type="button"
				tabindex="-1"
				aria-label="Menü schließen"
				class="fixed inset-0 z-10 cursor-default"
				onclick={() => (open = false)}
			></button>

			<div
				role="menu"
				class="absolute left-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
			>
				<p class="px-4 py-1.5 text-xs font-medium tracking-wide text-slate-400">Hinzufügen zu</p>
				{#each QUICK_ADD_TARGETS as target (target.id)}
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							selectedTargetId = target.id;
							open = false;
						}}
						class="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
					>
						{target.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<label for="quick-add" class="sr-only">Schnell hinzufügen</label>
	<input
		id="quick-add"
		type="text"
		name="name"
		autocomplete="off"
		required
		minlength={MIN_LENGTH}
		maxlength={MAX_LENGTH}
		bind:value
		placeholder="Schnell hinzufügen…"
		class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none"
	/>

	<button
		type="submit"
		aria-label="Hinzufügen"
		disabled={!canAdd}
		class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand"
	>
		<svg
			class="h-5 w-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>
</form>
