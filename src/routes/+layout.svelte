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
	<title>Purdue Hackers Ships</title>
	<meta
		name="description"
		content="Projects and progress from Purdue Hackers: ambitious ideas across software, hardware, and design, shared by the people building them."
	/>
	<link rel="canonical" href="https://ships.purduehackers.com/" />
	<meta property="og:title" content="Purdue Hackers Ships" />
	<meta
		property="og:description"
		content="Follow the software, hardware, and design projects shared by Purdue Hackers members."
	/>
	<meta property="og:url" content="https://ships.purduehackers.com/" />
	<meta property="og:type" content="website" />
</svelte:head>
<Nav />
<div class="pt-8">
	{@render children()}
</div>
