<script lang="ts">
	import type { ShoppingItem } from '@dahamm/shared';

	// Dashboard-Karte für die Einkaufsliste – reine Übersichtsdarstellung.
	// Noch ohne Daten-Anbindung: statische Platzhalter-Vorschau, damit das
	// Layout im Dashboard sichtbar ist. Die Logik (offene Posten laden, das
	// Quick-Add-Formular absenden) folgt in einem späteren Schritt.
	const items: ShoppingItem[] = [
		{ id: '1', name: 'Milch', done: false, createdAt: '2026-06-25T07:00:00.000Z' },
		{ id: '2', name: 'Vollkornbrot', done: false, createdAt: '2026-06-25T07:01:00.000Z' },
		{ id: '3', name: 'Kaffeebohnen', done: false, createdAt: '2026-06-25T07:02:00.000Z' }
	];
	const openCount = 7;
	const remaining = openCount - items.length;
</script>

<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
	<header class="flex items-center gap-3">
		<span
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
			aria-hidden="true"
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
		</span>

		<h2 class="flex-1 text-lg font-semibold tracking-tight text-slate-900">Einkaufsliste</h2>

		<span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
			{openCount} offen
		</span>
	</header>

	<ul class="mt-4 space-y-2.5">
		{#each items as item (item.id)}
			<li class="flex items-center gap-3 text-slate-700">
				<span class="h-5 w-5 shrink-0 rounded-md border-2 border-slate-300" aria-hidden="true"
				></span>
				<span>{item.name}</span>
			</li>
		{/each}
	</ul>

	{#if remaining > 0}
		<p class="mt-3 pl-8 text-sm font-medium text-slate-500">+ {remaining} weitere</p>
	{/if}
</section>
