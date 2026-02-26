<script lang="ts">
	type DraftLetter = { id: string; letter: string };
	type Props = {
		letters: DraftLetter[];
		timeLabel: string;
		selectedLetterId: string;
		alreadyHaveExtraLetter: boolean;
		onSubmit: (letterId: string) => void;
	};

	let { letters, timeLabel, selectedLetterId = $bindable(''), alreadyHaveExtraLetter, onSubmit }: Props = $props();

	function pickLetter(letter: DraftLetter) {
		if (alreadyHaveExtraLetter) return;
		selectedLetterId = letter.id;
		onSubmit(letter.id);
	}
</script>

<section class="card space-y-4 p-4">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-xl font-semibold">Vote for Letter to Auction</h2>
		<div class="flex items-center gap-2">
			<span class="badge preset-tonal-surface">Vote</span>
			<span class="badge preset-filled-secondary-500">{timeLabel}</span>
		</div>
	</div>
	<p class="text-sm opacity-80">
		Vote for which letter should go to auction next. The letter with the most votes is auctioned; then we vote again until everyone has a letter.
	</p>
	{#if alreadyHaveExtraLetter}
		<div class="rounded-lg border border-surface-300-700 bg-surface-100-900 p-4 text-center text-sm opacity-80">
			You have your extra letter. Waiting for others to vote…
		</div>
	{:else}
		<div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
			{#each letters as letter (letter.id)}
				<button
					class={`btn ${selectedLetterId === letter.id ? 'preset-filled-primary-500' : 'preset-tonal-surface'}`}
					onclick={() => pickLetter(letter)}
				>
					{letter.letter}
				</button>
			{/each}
		</div>
	{/if}
</section>
