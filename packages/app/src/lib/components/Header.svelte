<script lang="ts">
	import { resolve } from '$app/paths';

	type HeaderUser = { username: string; isAdmin: boolean };
	let { user }: { user: HeaderUser } = $props();

	let open = $state(false);
</script>

<header class="border-b border-slate-200 bg-white">
	<div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
		<a href={resolve('/')} class="text-lg font-semibold tracking-tight text-slate-900">Dahamm</a>

		<div class="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				onclick={() => (open = !open)}
				class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
			>
				<span>{user.username}</span>
				<svg
					class="h-4 w-4 text-slate-400"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
						clip-rule="evenodd"
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
					class="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
				>
					{#if user.isAdmin}
						<a
							href={resolve('/admin')}
							role="menuitem"
							class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
							onclick={() => (open = false)}
						>
							Admin
						</a>
					{/if}
					<form method="POST" action="/logout">
						<button
							type="submit"
							role="menuitem"
							class="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
						>
							Logout
						</button>
					</form>
				</div>
			{/if}
		</div>
	</div>
</header>
