<script lang="ts">
	import ship1 from '../assets/ship1.png';
	import ship2 from '../assets/ship2.png';
	import { initGliderSmoke } from '$lib/gliderSmoke';

	let { data } = $props();

	const frames = [ship1, ship2];
	let frame = $state(0);

	$effect(() => {
		const interval = setInterval(() => {
			frame = frame === 0 ? 1 : 0;
		}, 500);
		return () => clearInterval(interval);
	});

	let smokeCanvas: HTMLCanvasElement;

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
		const diff = Date.now() - new Date(iso).getTime();
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return minutes + 'm ago';
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return hours + 'h ago';
		const days = Math.floor(hours / 24);
		return days + 'd ago';
	}
</script>

<div class="min-h-screen bg-bg">
	<header class="relative z-50 border-b-4 border-border px-6 py-8 md:px-12 lg:px-24">
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
			<div class="relative shrink-0">
				<canvas
					bind:this={smokeCanvas}
					class="pointer-events-none absolute bottom-8 left-0 z-50"
					style="image-rendering: pixelated;"
				></canvas>
				<img
					src={frames[frame]}
					alt="Ship"
					class="relative z-10 h-[80px] w-[80px]"
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
		<div class="masonry">
			{#each data.ships as ship (ship.id)}
				<div class="masonry-item border-4 border-border p-4 font-body">
					<div class="flex items-center gap-2">
						{#if ship.avatarUrl}
							<img
								src={ship.avatarUrl}
								alt={ship.username}
								class="h-6 w-6 rounded-full"
							/>
						{:else}
							<div class="h-6 w-6 rounded-full bg-border"></div>
						{/if}
						<span class="text-sm font-bold text-text">{ship.username}</span>
						<span class="ml-auto text-sm text-muted">{relativeTime(ship.shippedAt)}</span>
					</div>

					{#if ship.contentHtml}
						<div class="ship-content mt-2 break-words text-sm text-muted" style="overflow-wrap: anywhere;">
							{@html ship.contentHtml}
						</div>
					{/if}

					{#if ship.attachments && ship.attachments.length > 0}
						<div class="mt-3 flex gap-2 overflow-hidden">
							{#each ship.attachments as attachment, i (attachment.url + '-' + i)}
								{#if attachment.type.startsWith('image')}
									<img
										src={attachment.url}
										alt={attachment.filename}
										class="max-h-[200px] object-cover"
									/>
								{:else if attachment.type.startsWith('video')}
									<video
										src={attachment.url}
										controls
										preload="metadata"
										class="max-h-[200px]"
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
	{/if}
</div>

<style>
	.masonry {
		columns: 1;
		column-gap: 0px;
	}

	@media (min-width: 640px) {
		.masonry {
			columns: 2;
		}
	}

	@media (min-width: 1024px) {
		.masonry {
			columns: 3;
		}
	}

	@media (min-width: 1280px) {
		.masonry {
			columns: 4;
		}
	}

	.masonry-item {
		break-inside: avoid;
	}
</style>
