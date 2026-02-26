<script lang="ts">
	let { board = [] }: { board: string[] } = $props();
	const gridSize = 5;
</script>

<section class="card p-4">
	<div class="mx-auto grid w-full max-w-[18rem] grid-cols-5 gap-1.5">
		{#each (board.length ? board : Array(gridSize * gridSize).fill('')) as letter}
			<div
				class="grid h-12 w-12 place-items-center rounded-lg border border-surface-300-700 bg-surface-100-900 text-lg font-semibold"
			>
				{letter || '-'}
			</div>
		{/each}
	</div>
</section>
