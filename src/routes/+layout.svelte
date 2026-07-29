<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/app-icon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon.png" sizes="32x32" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

<div class="shell">
	<header>
		<a href="/" class="brand">🧳 Belongings</a>
	</header>
	<main>
		{@render children()}
	</main>
</div>
