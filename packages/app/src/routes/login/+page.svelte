<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let { data } = $props();

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let email = $state('');
	let submitting = $state(false);
	let sent = $state(false);
	let invalidEmail = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		invalidEmail = false;

		const value = email.trim().toLowerCase();
		if (!EMAIL_RE.test(value) || value.length > 254) {
			invalidEmail = true;
			return;
		}

		submitting = true;
		// Identical UX regardless of whitelist membership: we always show the same
		// message and never surface the result, so timing/response can't be used to
		// enumerate registered addresses.
		await authClient.signIn
			.magicLink({
				email: value,
				callbackURL: '/',
				errorCallbackURL: '/login?error=invalid'
			})
			.catch(() => {});
		submitting = false;
		sent = true;
	}
</script>

<svelte:head>
	<title>Anmelden · Dahamm</title>
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
	<header class="space-y-2 text-center">
		<h1 class="text-3xl font-semibold tracking-tight">Dahamm</h1>
		<p class="text-sm text-slate-500">Melde dich mit deiner E-Mail-Adresse an.</p>
	</header>

	{#if data.error}
		<div
			role="alert"
			class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
		>
			Dieser Link ist abgelaufen oder wurde bereits verwendet. Gib deine E-Mail erneut ein, um einen
			neuen zu erhalten.
		</div>
	{/if}

	{#if sent}
		<div
			role="status"
			class="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
		>
			Wenn die Adresse registriert ist, wurde ein Link verschickt.
		</div>
	{:else}
		<!-- novalidate: our JS validation is the single source of truth so we can
		     show a consistent, styled German message instead of the browser bubble. -->
		<form class="space-y-4" novalidate onsubmit={handleSubmit}>
			<div class="space-y-1.5">
				<label for="email" class="block text-sm font-medium text-slate-700">E-Mail</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					inputmode="email"
					required
					bind:value={email}
					placeholder="du@beispiel.de"
					class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
				/>
				{#if invalidEmail}
					<p class="text-xs text-amber-700">Bitte gib eine gültige E-Mail-Adresse ein.</p>
				{/if}
			</div>
			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{submitting ? 'Wird gesendet …' : 'Link anfordern'}
			</button>
		</form>
	{/if}
</main>
