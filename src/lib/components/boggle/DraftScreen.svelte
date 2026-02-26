<script lang="ts">
	type DraftLetter = { id: string; letter: string };
	type Props = {
		letters: DraftLetter[];
		timeLabel: string;
		selectedLetterId: string;
		onSubmit: () => void;
	};

	let { letters, timeLabel, selectedLetterId = $bindable(''), onSubmit }: Props = $props();
</script>

<section class="card space-y-4 p-4">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-xl font-semibold">Extra Letter Draft</h2>
		<div class="flex items-center gap-2">
			<span class="badge preset-tonal-surface">Pick one letter</span>
			<span class="badge preset-filled-secondary-500">{timeLabel}</span>
		</div>
	</div>
	<p class="text-sm opacity-80">
		Everyone picks first. If multiple players choose the same letter, it goes to blind auction.
	</p>
	<div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
		{#each letters as letter}
			<button
				class={`btn ${selectedLetterId === letter.id ? 'preset-filled-primary-500' : 'preset-tonal-surface'}`}
				onclick={() => (selectedLetterId = letter.id)}
			>
				{letter.letter}
			</button>
		{/each}
	</div>
	<button class="btn preset-filled-primary-500" onclick={onSubmit}>Submit Pick</button>
</section>
