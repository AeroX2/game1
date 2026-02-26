<script lang="ts">
	import NumberStepper from './NumberStepper.svelte';

	type Props = {
		score: number;
		timeLabel: string;
		contestedLetter: string | null;
		stake: number;
		myBid: { stake: number } | null;
		alreadyHaveExtraLetter: boolean;
		onSubmit: () => void;
	};

	let { score, timeLabel, contestedLetter, stake = $bindable(0), myBid, alreadyHaveExtraLetter, onSubmit }: Props =
		$props();
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

	{#if alreadyHaveExtraLetter}
		<div class="rounded-lg border border-surface-300-700 bg-surface-100-900 p-4 text-center text-sm opacity-80">
			You have your extra letter. Waiting for auction to resolve…
		</div>
	{:else if myBid}
		<div class="card p-3">
			<p class="text-sm opacity-80">Your bid is locked in.</p>
			<p class="font-medium">Stake: {myBid.stake}</p>
		</div>
	{:else}
		<div class="card p-3">
			<p class="text-sm opacity-80">Now auctioning</p>
			<p class="text-2xl font-bold">{contestedLetter ?? '?'}</p>
		</div>
		<NumberStepper
			bind:value={stake}
			min={0}
			max={score}
			label="Stake"
		/>
		<button class="btn preset-filled-primary-500" onclick={onSubmit}>
			{stake > 0 ? 'Submit Auction Bid' : 'Skip Auction'}
		</button>
	{/if}
</section>
