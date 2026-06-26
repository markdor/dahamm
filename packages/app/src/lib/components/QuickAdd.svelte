<script lang="ts">
	// Globales Schnell-Hinzufügen auf dem Dashboard – Web-Pendant zum Bot.
	// Ein Eingabefeld plus „+"-Button, der ein Dropdown mit dem Ziel öffnet
	// (Einkaufsliste, später Todos/Essensplaner). Die eigentliche Submit-Logik
	// folgt in einem späteren Schritt – aktuell nur die UI.

	import { SHOPPING_ITEM_NAME_LENGTH } from '@dahamm/shared';

	type Target = { id: string; label: string };

	// Verfügbare Ziele. Aktuell nur die Einkaufsliste; weitere Module folgen.
	const targets: Target[] = [{ id: 'shopping', label: 'Einkaufsliste' }];

	// Eingabe-Constraints aus der geteilten Domänen-Definition: mind. 3 Zeichen
	// (getrimmt), damit der „+"-Button aktiv wird; max. 32 Zeichen (auch hart per
	// maxlength am Input erzwungen). Einziges Ziel ist aktuell die Einkaufsliste.
	const { min: MIN_LENGTH, max: MAX_LENGTH } = SHOPPING_ITEM_NAME_LENGTH;

	let open = $state(false);
	let value = $state('');

	const canAdd = $derived(value.trim().length >= MIN_LENGTH);

	function selectTarget(_target: Target) {
		// Submit-Logik folgt – hier wird der Eintrag später ans Modul übergeben.
		open = false;
	}
</script>

<div class="flex gap-2">
	<label for="quick-add" class="sr-only">Schnell hinzufügen</label>
	<input
		id="quick-add"
		type="text"
		name="quick-add"
		autocomplete="off"
		maxlength={MAX_LENGTH}
		bind:value
		placeholder="Schnell hinzufügen…"
		class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none"
	/>

	<div class="relative">
		<button
			type="button"
			aria-haspopup="menu"
			aria-expanded={open}
			aria-label="Ziel wählen"
			disabled={!canAdd}
			onclick={() => (open = !open)}
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
				class="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
			>
				<p class="px-4 py-1.5 text-xs font-medium tracking-wide text-slate-400">Hinzufügen zu</p>
				{#each targets as target (target.id)}
					<button
						type="button"
						role="menuitem"
						onclick={() => selectTarget(target)}
						class="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
					>
						{target.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
