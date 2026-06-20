<script lang="ts">
	import './layout.css';
	import Header from '$lib/components/Header.svelte';

	let { data, children } = $props();
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
	{#if data.user}
		<Header user={data.user} />
	{/if}
	{@render children()}
</div>
