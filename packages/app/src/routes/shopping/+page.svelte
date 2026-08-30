<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Check, ChevronLeft, Plus } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { SHOPPING_ITEM_NAME_LENGTH, type ShoppingItem } from '@dahamm/shared';
	import { toastActionFailure } from '$lib/components/actionToast';
	import { getGraceDelayMs } from './graceDelay';

	let { data } = $props();

	const { min: MIN_LENGTH, max: MAX_LENGTH } = SHOPPING_ITEM_NAME_LENGTH;

	// Both lists are the source of truth for this page (not `data`, which is
	// only the initial load) – toggling an item moves it live between the two
	// instead of relying on a server round trip to resync. See CLAUDE.md /
	// issue #22 plan for why. untrack: deliberately only a one-time snapshot,
	// not a derived that would track `data` (which never changes after the
	// initial load – this page manages its own state from here on).
	let openItems = $state<ShoppingItem[]>(untrack(() => data.openItems));
	let doneItems = $state<ShoppingItem[]>([]);
	let doneCount = $state(untrack(() => data.doneCount));
	let doneLoaded = $state(false);
	let showDone = $state(false);
	let hasMoreDone = $state(false);
	let nextCursor = $state<string | undefined>(undefined);

	let addValue = $state('');
	let editingId = $state<string | null>(null);
	let editValue = $state('');

	let forms = $state<Record<string, HTMLFormElement | null>>({});
	let loadMoreForm = $state<HTMLFormElement | null>(null);

	// Checked-off / reopened items within the grace period: id → timer handle,
	// so a second click (undo) can cancel it. Mirrors ShoppingCard.svelte,
	// extended to work in both directions (complete and uncomplete).
	const pending = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	const committing = new SvelteSet<string>();

	const canAdd = $derived(addValue.trim().length >= MIN_LENGTH);

	function insertByCreatedAtDesc(list: ShoppingItem[], entry: ShoppingItem): ShoppingItem[] {
		const at = list.findIndex((i) => i.createdAt < entry.createdAt);
		const index = at === -1 ? list.length : at;
		return [...list.slice(0, index), entry, ...list.slice(index)];
	}

	function isToggling(id: string): boolean {
		return pending.has(id) || committing.has(id);
	}

	// The visual "checked" state: an open item looks checked while it's being
	// completed, a done item looks unchecked while it's being reopened.
	function isChecked(item: ShoppingItem): boolean {
		return isToggling(item.id) ? !item.done : item.done;
	}

	function toggleLabel(item: ShoppingItem): string {
		const toggling = isToggling(item.id);
		return item.done
			? toggling
				? `${item.name} doch nicht wieder öffnen`
				: `${item.name} wieder öffnen`
			: toggling
				? `${item.name} doch nicht abhaken`
				: `${item.name} abhaken`;
	}

	function toggle(item: ShoppingItem) {
		if (committing.has(item.id)) return;

		const timer = pending.get(item.id);
		if (timer !== undefined) {
			clearTimeout(timer);
			pending.delete(item.id);
			return;
		}

		pending.set(
			item.id,
			setTimeout(() => {
				pending.delete(item.id);
				committing.add(item.id);
				forms[item.id]?.requestSubmit();
			}, getGraceDelayMs())
		);
	}

	function onPersist(item: ShoppingItem): SubmitFunction {
		return () =>
			async ({ result }) => {
				committing.delete(item.id);
				if (result.type === 'success') {
					if (item.done) {
						doneItems = doneItems.filter((i) => i.id !== item.id);
						doneCount = Math.max(0, doneCount - 1);
						openItems = insertByCreatedAtDesc(openItems, { ...item, done: false });
					} else {
						openItems = openItems.filter((i) => i.id !== item.id);
						doneCount += 1;
						if (doneLoaded) {
							doneItems = insertByCreatedAtDesc(doneItems, { ...item, done: true });
						}
					}
				} else {
					toastActionFailure(
						result,
						'Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.'
					);
				}
			};
	}

	function startEdit(item: ShoppingItem) {
		editingId = item.id;
		editValue = item.name;
	}

	function cancelEdit() {
		editingId = null;
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		}
	}

	// Blur cancels the edit unless focus is moving to the confirm button of the
	// same form (otherwise clicking "confirm" would close the edit before the
	// click's submit had a chance to fire).
	function onEditBlur(e: FocusEvent) {
		const next = e.relatedTarget as HTMLElement | null;
		const form = (e.currentTarget as HTMLElement).closest('form');
		if (next && form?.contains(next)) return;
		cancelEdit();
	}

	function applyNameChange(id: string, name: string, done: boolean) {
		const apply = (list: ShoppingItem[]) => list.map((i) => (i.id === id ? { ...i, name } : i));
		if (done) doneItems = apply(doneItems);
		else openItems = apply(openItems);
	}

	function renameSubmit(item: ShoppingItem): SubmitFunction {
		return ({ formData }) => {
			const newName = String(formData.get('name') ?? '').trim();
			const oldName = item.name;
			applyNameChange(item.id, newName, item.done);
			editingId = null;
			return async ({ result }) => {
				if (result.type !== 'success') {
					applyNameChange(item.id, oldName, item.done);
					toastActionFailure(
						result,
						'Eintrag konnte nicht umbenannt werden. Bitte versuche es erneut.'
					);
				}
			};
		};
	}

	const addOptimistic: SubmitFunction = ({ formData }) => {
		const name = String(formData.get('name') ?? '').trim();
		const tempId = `temp-${crypto.randomUUID()}`;
		const tempItem: ShoppingItem = {
			id: tempId,
			name,
			done: false,
			createdAt: new Date().toISOString()
		};
		openItems = [tempItem, ...openItems];
		addValue = '';

		return async ({ result }) => {
			if (result.type === 'success' && result.data && 'item' in result.data) {
				const created = result.data.item as ShoppingItem;
				openItems = openItems.map((i) => (i.id === tempId ? created : i));
			} else {
				openItems = openItems.filter((i) => i.id !== tempId);
				toastActionFailure(
					result,
					'Eintrag konnte nicht hinzugefügt werden. Bitte versuche es erneut.'
				);
			}
		};
	};

	const onLoadMoreDone: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				const loaded = result.data as {
					items: ShoppingItem[];
					nextCursor?: string;
					hasMore: boolean;
				};
				const existingIds = new Set(doneItems.map((i) => i.id));
				const newItems = loaded.items.filter((i) => !existingIds.has(i.id));
				doneItems = [...doneItems, ...newItems];
				nextCursor = loaded.nextCursor;
				hasMoreDone = loaded.hasMore;
				doneLoaded = true;
			} else {
				toastActionFailure(
					result,
					'Erledigte Posten konnten nicht geladen werden. Bitte versuche es erneut.'
				);
			}
		};
	};

	function onToggleShowDone(e: Event) {
		const checked = (e.currentTarget as HTMLInputElement).checked;
		showDone = checked;
		if (checked && !doneLoaded) {
			loadMoreForm?.requestSubmit();
		}
	}
</script>

<svelte:head>
	<title>Einkaufsliste · Dahamm</title>
</svelte:head>

{#snippet itemRow(item: ShoppingItem)}
	{@const checked = isChecked(item)}
	<li class="flex items-center gap-3 py-2">
		<button
			type="button"
			onclick={() => toggle(item)}
			aria-pressed={checked}
			aria-label={toggleLabel(item)}
			class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors"
			class:border-slate-300={!checked}
			class:border-brand={checked}
			class:bg-brand={checked}
			class:text-white={checked}
		>
			{#if checked}
				<Check size={14} strokeWidth={3} />
			{/if}
		</button>

		{#if editingId === item.id}
			<form
				method="POST"
				action="?/renameShoppingItem"
				use:enhance={renameSubmit(item)}
				class="flex flex-1 items-center gap-2"
			>
				<input type="hidden" name="id" value={item.id} />
				<input
					name="name"
					bind:value={editValue}
					required
					minlength={MIN_LENGTH}
					maxlength={MAX_LENGTH}
					onkeydown={onEditKeydown}
					onblur={onEditBlur}
					class="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none"
				/>
				<button
					type="submit"
					aria-label="Umbenennen bestätigen"
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white hover:bg-brand-hover"
				>
					<Check size={20} strokeWidth={2} />
				</button>
			</form>
		{:else}
			<button
				type="button"
				onclick={() => startEdit(item)}
				class="min-w-0 flex-1 truncate text-left"
				class:text-slate-700={!checked}
				class:text-slate-400={checked}
				class:line-through={checked}
				class:italic={checked}
			>
				{item.name}
			</button>
		{/if}

		<!-- Hidden: persists the toggle only after the grace period expires. -->
		<form
			bind:this={forms[item.id]}
			method="POST"
			action={item.done ? '?/uncompleteShoppingItem' : '?/completeShoppingItem'}
			use:enhance={onPersist(item)}
			class="hidden"
		>
			<input type="hidden" name="id" value={item.id} />
		</form>
	</li>
{/snippet}

<div class="sticky top-0 z-10 border-b border-slate-200 bg-white">
	<div class="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
		<a
			href={resolve('/')}
			aria-label="Zurück zum Dashboard"
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
		>
			<ChevronLeft size={20} strokeWidth={2} />
		</a>
		<h1 class="flex-1 text-lg font-semibold tracking-tight text-slate-900">Einkaufsliste</h1>
		<span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
			{openItems.length} offen
		</span>
	</div>

	<form
		method="POST"
		action="?/addShoppingItem"
		use:enhance={addOptimistic}
		class="mx-auto flex max-w-3xl gap-2 px-4 pb-3"
	>
		<label for="shopping-add" class="sr-only">Posten hinzufügen</label>
		<input
			id="shopping-add"
			type="text"
			name="name"
			autocomplete="off"
			required
			minlength={MIN_LENGTH}
			maxlength={MAX_LENGTH}
			bind:value={addValue}
			placeholder="Posten hinzufügen…"
			class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none"
		/>
		<button
			type="submit"
			aria-label="Hinzufügen"
			disabled={!canAdd}
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand"
		>
			<Plus size={20} strokeWidth={2} aria-hidden="true" />
		</button>
	</form>
</div>

<main class="mx-auto max-w-3xl px-4 py-4">
	<label class="flex items-center gap-2 text-sm text-slate-700">
		<input
			type="checkbox"
			checked={showDone}
			onchange={onToggleShowDone}
			class="h-4 w-4 rounded border-slate-300"
		/>
		Erledigte anzeigen
	</label>

	{#if openItems.length === 0}
		<p class="mt-4 text-sm text-slate-500">Keine offenen Posten – alles erledigt. 🎉</p>
	{:else}
		<ul class="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
			{#each openItems as item (item.id)}
				{@render itemRow(item)}
			{/each}
		</ul>
	{/if}

	{#if showDone}
		<div class="mt-6">
			<h2 class="text-sm font-medium text-slate-500">Erledigt · {doneCount}</h2>

			{#if doneItems.length > 0}
				<ul
					class="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4"
				>
					{#each doneItems as item (item.id)}
						{@render itemRow(item)}
					{/each}
				</ul>
			{/if}

			{#if hasMoreDone}
				<button
					type="button"
					onclick={() => loadMoreForm?.requestSubmit()}
					class="mt-3 text-sm font-medium text-brand hover:underline"
				>
					Mehr laden
				</button>
			{/if}
		</div>
	{/if}

	<form
		bind:this={loadMoreForm}
		method="POST"
		action="?/loadMoreDone"
		use:enhance={onLoadMoreDone}
		class="hidden"
	>
		<input type="hidden" name="cursor" value={nextCursor ?? ''} />
	</form>
</main>
