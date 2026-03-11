<script lang="ts">
	import './layout.css';
	import Nav from '$lib/components/Nav.svelte';
	import favicon from '$lib/assets/favicon.png';
	import faviconLight from '$lib/assets/favicon-light.png';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} media="(prefers-color-scheme: light)" />
	<link rel="icon" href={faviconLight} media="(prefers-color-scheme: dark)" />
</svelte:head>
<Nav />
<div class="pt-8">
	{@render children()}
</div>
