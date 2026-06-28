<script lang="ts">
	import QuickAdd from '$lib/components/QuickAdd.svelte';
	import ShoppingCard from '$lib/components/ShoppingCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Dashboard · Dahamm</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-8">
	<h1 class="text-2xl font-semibold tracking-tight">Hallo {data.user?.username} 👋</h1>
	<p class="mt-2 text-sm text-slate-500">
		Willkommen bei Dahamm. Die Module Todos und Essensplaner folgen.
	</p>

	<div class="mt-6">
		<QuickAdd />
	</div>

	<div class="mt-6">
		<ShoppingCard items={data.shoppingItems} />
	</div>
</main>
