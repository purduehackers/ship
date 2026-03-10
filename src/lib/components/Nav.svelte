<script lang="ts">
	let scrolled = $state(false);

	$effect(() => {
		function onScroll() {
			scrolled = window.scrollY > 2;
		}
		window.addEventListener('scroll', onScroll, { passive: true });
		onScroll();
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<nav
	class={`fixed top-0 z-40 w-full h-8 flex items-center transition-colors duration-200 ${scrolled ? 'bg-primary' : 'bg-transparent'}`}
>
	<div class="w-full px-2 md:px-3 mx-auto flex justify-between items-center">
		<!-- Left: Glider icon -->
		<a href="https://purduehackers.com" target="_blank" rel="noopener noreferrer" aria-label="Purdue Hackers">
			<svg
				class="w-4 h-4"
				viewBox="0 0 16 16"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M5.333 5.333h5.333v5.333H5.333zM10.667 5.333H16v5.333h-5.333zM5.333 0h5.333v5.333H5.333zM10.667 10.667H16V16h-5.333zM0 10.667h5.333V16H0z"
				/>
			</svg>
		</a>

		<!-- Center: Buttons -->
		<div class="flex gap-2 justify-center">
			<a href="https://purduehackers.com" target="_blank" rel="noopener noreferrer">
				<button
					class={`cursor-pointer px-2 uppercase text-sm font-pixel font-normal rounded-none ${scrolled ? 'text-white bg-transparent border border-white' : 'text-white/85 bg-transparent border border-white/85'}`}
				>
					Learn more
				</button>
			</a>
			<a href="https://discord.com/invite/5paFjKzdPE" target="_blank" rel="noopener noreferrer">
				<button
					class={`cursor-pointer px-2 uppercase text-sm font-pixel font-normal rounded-none ${scrolled ? 'text-primary bg-white' : 'text-black bg-white/85'}`}
				>
					Join us
				</button>
			</a>
		</div>

		<!-- Right: Empty for balance -->
		<div class="w-4 h-4"></div>
	</div>
</nav>
