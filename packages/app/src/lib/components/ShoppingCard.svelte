<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Check, ShoppingCart } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ShoppingItem } from '@dahamm/shared';
	import { toast } from './toastStore.svelte';

	// removeDelayMs ist als Prop herausgezogen, damit Tests die Gnadenfrist
	// verkürzen können – in der App bleibt es bei 2 Sekunden.
	let { items, removeDelayMs = 2000 }: { items: ShoppingItem[]; removeDelayMs?: number } = $props();

	// Wie viele offene Posten die Karte als Vorschau zeigt (Rest als „+ N weitere").
	const PREVIEW_LIMIT = 4;

	// Abgehakte Posten in der Gnadenfrist: durchgestrichen sichtbar, noch NICHT in
	// der DB gespeichert. id → Timer-Handle, damit ein zweiter Klick (Undo) den
	// Timer abbrechen kann. Wird der Posten nie gespeichert, bleibt er offen.
	const pending = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	// Frist abgelaufen, DB-Schreibvorgang läuft – nicht mehr abbrechbar.
	const committing = new SvelteSet<string>();
	// Erfolgreich gespeichert → komplett aus der Anzeige raus.
	const hidden = new SvelteSet<string>();
	// Referenzen auf die versteckten Persist-Forms (ein Form pro Posten).
	let forms = $state<Record<string, HTMLFormElement | null>>({});

	const live = $derived(items.filter((item) => !hidden.has(item.id)));
	const shown = $derived(live.slice(0, PREVIEW_LIMIT));
	const remaining = $derived(live.length - shown.length);

	function isStruck(id: string): boolean {
		return pending.has(id) || committing.has(id);
	}

	// Klick auf die Box: erst durchstreichen + Frist starten; zweiter Klick
	// innerhalb der Frist macht das Abhaken rückgängig (kein DB-Schreibvorgang).
	function toggle(id: string) {
		if (committing.has(id)) return; // Schreibvorgang läuft schon – ignorieren

		const timer = pending.get(id);
		if (timer !== undefined) {
			clearTimeout(timer);
			pending.delete(id);
			return;
		}

		pending.set(
			id,
			setTimeout(() => {
				pending.delete(id);
				committing.add(id);
				// Jetzt erst wirklich speichern; das Form-Submit läuft über enhance.
				forms[id]?.requestSubmit();
			}, removeDelayMs)
		);
	}

	function onPersist(id: string): SubmitFunction {
		return () =>
			async ({ result }) => {
				committing.delete(id);
				if (result.type === 'success') {
					hidden.add(id);
					invalidateAll();
				} else {
					// Bei Fehler kein hidden/pending → der Posten erscheint wieder offen.
					const serverMessage =
						result.type === 'failure' && typeof result.data?.error === 'string'
							? result.data.error
							: undefined;
					toast.show(
						'error',
						serverMessage ?? 'Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.'
					);
				}
			};
	}
</script>

<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
	<header class="flex items-center gap-3">
		<span
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
			aria-hidden="true"
		>
			<ShoppingCart size={20} strokeWidth={2} />
		</span>

		<h2 class="flex-1 text-lg font-semibold tracking-tight text-slate-900">Einkaufsliste</h2>

		<span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
			{live.length} offen
		</span>
	</header>

	{#if shown.length === 0}
		<p class="mt-4 text-sm text-slate-500">Keine offenen Posten – alles erledigt. 🎉</p>
	{:else}
		<ul class="mt-4 space-y-1">
			{#each shown as item (item.id)}
				{@const struck = isStruck(item.id)}
				<li>
					<button
						type="button"
						onclick={() => toggle(item.id)}
						aria-pressed={struck}
						aria-label={struck ? `${item.name} doch nicht abhaken` : `${item.name} abhaken`}
						class="flex w-full items-center gap-3 rounded-lg py-1.5 text-left transition-colors hover:bg-slate-50"
					>
						<span
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors"
							class:border-slate-300={!struck}
							class:border-brand={struck}
							class:bg-brand={struck}
							class:text-white={struck}
							aria-hidden="true"
						>
							{#if struck}
								<Check size={14} strokeWidth={3} />
							{/if}
						</span>
						<span
							class:text-slate-700={!struck}
							class:italic={struck}
							class:text-slate-400={struck}
							class:line-through={struck}
						>
							{item.name}
						</span>
					</button>

					<!-- Versteckt: persistiert das Abhaken erst nach Ablauf der Frist. -->
					<form
						bind:this={forms[item.id]}
						method="POST"
						action="?/completeShoppingItem"
						use:enhance={onPersist(item.id)}
						class="hidden"
					>
						<input type="hidden" name="id" value={item.id} />
					</form>
				</li>
			{/each}
		</ul>

		{#if remaining > 0}
			<p class="mt-3 pl-8 text-sm font-medium text-slate-500">+ {remaining} weitere</p>
		{/if}
	{/if}
</section>
