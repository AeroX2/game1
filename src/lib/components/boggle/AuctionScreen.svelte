<script lang="ts">
	type Props = {
		score: number;
		timeLabel: string;
		contestedLetter: string | null;
		stake: number;
		myBid: { stake: number } | null;
		onSubmit: () => void;
	};

	let { score, timeLabel, contestedLetter, stake = $bindable(0), myBid, onSubmit }: Props = $props();
</script>

<section class="card space-y-4 p-4">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-xl font-semibold">Letter Auction</h2>
		<div class="flex items-center gap-2">
			<span class="badge preset-tonal-surface">Blind, one-time bid</span>
			<span class="badge preset-filled-secondary-500">{timeLabel}</span>
		</div>
	</div>
	<div class="card p-3">
		<p class="text-sm opacity-80">Available points</p>
		<p class="text-2xl font-bold">{score}</p>
	</div>

	{#if myBid}
		<div class="card p-3">
			<p class="text-sm opacity-80">Your bid is locked in.</p>
			<p class="font-medium">Stake: {myBid.stake}</p>
		</div>
	{:else}
		<div class="card p-3">
			<p class="text-sm opacity-80">Now auctioning</p>
			<p class="text-2xl font-bold">{contestedLetter ?? '?'}</p>
		</div>
		<div class="grid gap-1">
			<span class="text-sm font-semibold">Stake</span>
			<input class="input" type="number" min="0" bind:value={stake} />
		</div>
		<button class="btn preset-filled-primary-500" onclick={onSubmit}>
			{stake > 0 ? 'Submit Auction Bid' : 'Skip Auction'}
		</button>
	{/if}
</section>
