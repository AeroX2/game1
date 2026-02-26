<script lang="ts">
	let {
		board = [],
		extraLetter = null,
		highlightPath = null
	}: { board: string[]; extraLetter?: string | null; highlightPath?: number[] | null } = $props();
	const gridSize = 5;
	const cells = $derived(board.length ? board : Array(gridSize * gridSize).fill(''));

	function isHighlighted(index: number): boolean {
		if (!highlightPath || highlightPath.length === 0) return false;
		return highlightPath.includes(index);
	}

	const highlightExtra = $derived(Boolean(highlightPath?.includes(-1)));
</script>

<section class="card p-4">
	<div class="mx-auto flex w-full max-w-[18rem] items-start">
		<div class="grid flex-1 grid-cols-5 gap-1.5">
			{#each cells as letter, i (i)}
				<div
					class="grid h-12 w-12 place-items-center rounded-lg border text-lg font-semibold transition-all duration-300 {isHighlighted(i)
						? 'border-primary-500 bg-primary-500/25 scale-110 shadow-md'
						: 'border-surface-300-700 bg-surface-100-900'}"
				>
					{letter || '-'}
				</div>
			{/each}
		</div>
		{#if extraLetter != null}
			<div class="ml-6 flex flex-col items-center gap-1 self-center">
				<span class="text-xs font-medium opacity-60">Extra</span>
				<div
					class="grid h-12 w-12 shrink-0 place-items-center rounded-lg border text-lg font-semibold transition-all duration-300 {highlightExtra
						? 'border-primary-500 bg-primary-500/25 scale-110 shadow-md'
						: 'border-surface-300-700 bg-surface-100-900'}"
				>
					{extraLetter}
				</div>
			</div>
		{/if}
	</div>
</section>
