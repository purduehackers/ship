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
	class={`fixed top-0 flex h-8 w-full items-center transition-colors duration-200 ${scrolled ? 'z-40 bg-primary' : 'z-10 bg-transparent'}`}
>
	<div class="mx-auto flex w-full items-center justify-between px-2 md:px-3">
		<!-- Left: Glider icon -->
		<a
			href="https://purduehackers.com"
			target="_blank"
			rel="noopener noreferrer"
			aria-label="Purdue Hackers"
		>
			<svg
				class="h-4 w-4"
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
		<div class="flex justify-center gap-2">
			<a href="https://purduehackers.com" target="_blank" rel="noopener noreferrer">
				<button
					class={`cursor-pointer rounded-none px-2 font-pixel text-sm font-normal uppercase ${scrolled ? 'border border-white bg-transparent text-white' : 'border border-white/85 bg-transparent text-white/85'}`}
				>
					Learn more
				</button>
			</a>
			<a href="https://discord.com/invite/5paFjKzdPE" target="_blank" rel="noopener noreferrer">
				<button
					class={`cursor-pointer rounded-none px-2 font-pixel text-sm font-normal uppercase ${scrolled ? 'bg-white text-primary' : 'bg-white/85 text-black'}`}
				>
					Join us
				</button>
			</a>
		</div>

		<!-- Right: Empty for balance -->
		<div class="h-4 w-4"></div>
	</div>
</nav>
