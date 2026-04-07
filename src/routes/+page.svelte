<script lang="ts">
	import ship1 from '../assets/ship1.png';
	import ship2 from '../assets/ship2.png';
	import { initGliderSmoke } from '$lib/gliderSmoke';

	let { data } = $props();

	const frames = [ship1, ship2];
	let frame = $state(0);
	let loadingFrame = $state(0);

	$effect(() => {
		const interval = setInterval(() => {
			frame = frame === 0 ? 1 : 0;
		}, 500);
		const fast = setInterval(() => {
			loadingFrame = loadingFrame === 0 ? 1 : 0;
		}, 250);
		return () => {
			clearInterval(interval);
			clearInterval(fast);
		};
	});

	let smokeCanvas: HTMLCanvasElement;
	let shipRef = $state<HTMLDivElement>();

	// Position canvas over the ship sprite
	$effect(() => {
		if (!smokeCanvas || !shipRef) return;
		function positionCanvas() {
			if (!shipRef || !smokeCanvas) return;
			const rect = shipRef.getBoundingClientRect();
			const scrollY = window.scrollY;
			// Canvas is 60*4=240px wide, 80*4=320px tall, anchored bottom-left of ship
			smokeCanvas.style.left = `${rect.left}px`;
			smokeCanvas.style.top = `${rect.top + scrollY + rect.height - 320 - 32}px`;
		}
		positionCanvas();
		window.addEventListener('scroll', positionCanvas, { passive: true });
		window.addEventListener('resize', positionCanvas);
		return () => {
			window.removeEventListener('scroll', positionCanvas);
			window.removeEventListener('resize', positionCanvas);
		};
	});

	$effect(() => {
		if (!smokeCanvas) return;
		const cleanup = initGliderSmoke(smokeCanvas, {
			gridCols: 60,
			gridRows: 80,
			cellSize: 4,
			speedMs: 120,
			cellColor: [1, 1, 1],
			spawnCol: 8,
			spawnRow: 68,
			spawnInterval: 30
		});
		return cleanup;
	});

	function relativeTime(iso: string): string {
		const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' });
		const diff = Date.now() - new Date(iso).getTime();
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return 'just now';
		else if (minutes < 60) return formatter.format(-minutes, "minute");
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return formatter.format(-hours, "hour");
		const days = Math.floor(hours / 24);
		if (days < 14) return formatter.format(-days, "day");
		const weeks = Math.floor(days / 7);
		return formatter.format(-weeks, "week");
	}

	let masonryContainer = $state<HTMLDivElement>();
	let masonryReady = $state(false);
	let savedScrollY: number | null = null;
	let allImagesLoaded = false;

	function checkAllImagesLoaded() {
		if (!masonryContainer) return false;
		const imgs = masonryContainer.querySelectorAll('img');
		return Array.from(imgs).every((img) => img.complete);
	}

	function layoutMasonry() {
		if (!masonryContainer) return;
		const items = Array.from(masonryContainer.children) as HTMLElement[];
		if (items.length === 0) return;

		const containerWidth = masonryContainer.offsetWidth;
		const cols =
			containerWidth >= 1280 ? 4 : containerWidth >= 1024 ? 3 : containerWidth >= 640 ? 2 : 1;
		const colWidth = containerWidth / cols;
		const colHeights = new Array(cols).fill(0);

		for (const item of items) {
			item.style.position = 'absolute';
			item.style.width = `${colWidth}px`;

			const shortest = colHeights.indexOf(Math.min(...colHeights));
			item.style.left = `${shortest * colWidth}px`;
			item.style.top = `${colHeights[shortest]}px`;
			colHeights[shortest] += item.offsetHeight;
		}

		masonryContainer.style.height = `${Math.max(...colHeights)}px`;
		if (!masonryReady) masonryReady = true;

		// Keep restoring scroll until all images are loaded
		if (savedScrollY !== null && !allImagesLoaded) {
			const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
			if (savedScrollY <= maxScroll) {
				window.scrollTo(0, savedScrollY);
			}
			if (checkAllImagesLoaded()) {
				allImagesLoaded = true;
				savedScrollY = null;
			}
		}
	}

	$effect(() => {
		// Read saved scroll on mount
		const saved = sessionStorage.getItem('ships-scroll');
		if (saved) savedScrollY = parseInt(saved);

		// Save scroll position on unload
		const onBeforeUnload = () => {
			sessionStorage.setItem('ships-scroll', String(window.scrollY));
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});

	$effect(() => {
		if (!masonryContainer) return;

		layoutMasonry();

		const ro = new ResizeObserver(() => layoutMasonry());
		ro.observe(masonryContainer);

		const handleLoad = () => layoutMasonry();
		masonryContainer.addEventListener('load', handleLoad, true);

		return () => {
			ro.disconnect();
			masonryContainer?.removeEventListener('load', handleLoad, true);
		};
	});
</script>

<div class="min-h-screen overflow-x-clip bg-bg">
	<canvas
		bind:this={smokeCanvas}
		class="pointer-events-none absolute z-20"
		style="image-rendering: pixelated;"
	></canvas>
	<header class="relative border-b-4 border-border bg-bg px-6 py-8 md:px-12 lg:px-24">
		<div
			class="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<h1 class="font-pixel text-5xl leading-tight text-text md:text-7xl">
					Purdue Hackers Ships
				</h1>
				<p class="mt-1 font-body text-sm text-muted">
					A feed of everything Purdue Hackers members have shipped.
				</p>
			</div>
			<div class="relative shrink-0" bind:this={shipRef}>
				<img
					src={frames[frame]}
					alt="Ship"
					class="relative h-[80px] w-[80px]"
					style="image-rendering: pixelated; filter: invert(1);"
				/>
			</div>
		</div>
	</header>

	{#if data.ships.length === 0}
		<div class="flex items-center justify-center py-24">
			<p class="font-body text-lg text-muted">No ships yet.</p>
		</div>
	{:else}
		{#if !masonryReady}
			<div class="flex flex-col items-center justify-center gap-3 py-24">
				<img
					src={frames[loadingFrame]}
					alt="Loading"
					class="h-16 w-16"
					style="image-rendering: pixelated; filter: invert(1);"
				/>
				<p class="font-pixel text-sm text-muted">Laying out feed...</p>
			</div>
		{/if}
		<div class="masonry" bind:this={masonryContainer} class:masonry-ready={masonryReady}>
			{#each data.ships as ship (ship.id)}
				<div class="border-4 border-border p-4 font-body">
					<div class="flex items-center gap-2">
						{#if ship.avatarUrl}
							<img src={ship.avatarUrl} alt={ship.username} class="h-6 w-6 rounded-full" />
						{:else}
							<div class="h-6 w-6 rounded-full bg-border"></div>
						{/if}
						<span class="text-sm font-bold text-text">{ship.username}</span>
						<span class="ml-auto text-sm text-muted">{relativeTime(ship.shippedAt)}</span>
					</div>

					{#if ship.contentHtml}
						<div
							class="ship-content mt-2 text-sm break-words text-muted"
							style="overflow-wrap: anywhere;"
						>
							{@html ship.contentHtml}
						</div>
					{/if}

					{#if ship.attachments && ship.attachments.length > 0}
						<div class="mt-3 flex flex-col items-start gap-2">
							{#each ship.attachments as attachment, i (attachment.url + '-' + i)}
								{#if attachment.type.startsWith('image')}
									<img
										src={attachment.url}
										alt={attachment.filename}
										width={attachment.width}
										height={attachment.height}
										class="max-w-full rounded"
										style={attachment.width && attachment.height
											? `aspect-ratio: ${attachment.width}/${attachment.height};`
											: ''}
									/>
								{:else if attachment.type.startsWith('video')}
									<video
										src={attachment.url}
										controls
										preload="metadata"
										width={attachment.width}
										height={attachment.height}
										class="max-w-full rounded"
										style={attachment.width && attachment.height
											? `aspect-ratio: ${attachment.width}/${attachment.height};`
											: 'aspect-ratio: 16/9;'}
										onloadedmetadata={() => layoutMasonry()}
									>
										<track kind="captions" />
									</video>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
		{#if masonryReady}
			<div class="py-12 text-center font-body text-sm text-muted">
				You've reached the end! That's every ship so far.
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Hidden until JS masonry positions everything */
	.masonry {
		position: relative;
		visibility: hidden;
	}

	.masonry-ready {
		visibility: visible;
	}
</style>
