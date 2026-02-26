<script lang="ts">
	type PlayerOption = { id: string; name: string };
	type PredictionBet = { targetPlayerId: string; predictedWords: number; stake: number };

	type Props = {
		round: number;
		totalRounds: number;
		timeLabel: string;
		score: number;
		targets: PlayerOption[];
		selectedTarget: string;
		predictedWords: number;
		stake: number;
		myBet: PredictionBet | null;
		mySkipped: boolean;
		onSubmit: () => void;
		onSkip: () => void;
	};

	let {
		round,
		totalRounds,
		timeLabel,
		score,
		targets,
		selectedTarget = $bindable(''),
		predictedWords = $bindable(3),
		stake = $bindable(1),
		myBet,
		mySkipped,
		onSubmit,
		onSkip
	}: Props = $props();
</script>

<section class="card space-y-4 p-4">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-xl font-semibold">Prediction Bet</h2>
		<div class="flex items-center gap-2">
			<span class="badge preset-tonal-surface">Round {round}/{totalRounds}</span>
			<span class="badge preset-filled-secondary-500">{timeLabel}</span>
		</div>
	</div>
	<div class="card p-3">
		<p class="text-sm opacity-80">Available points (betting money)</p>
		<p class="text-2xl font-bold">{score}</p>
	</div>

	{#if myBet}
		<div class="card p-3">
			<p class="text-sm opacity-80">Your prediction is locked in:</p>
			<p class="font-medium">
				{myBet.predictedWords} words for {targets.find((entry) => entry.id === myBet.targetPlayerId)?.name ??
					'Unknown'} (stake {myBet.stake})
			</p>
		</div>
	{:else if mySkipped}
		<div class="card p-3">
			<p class="text-sm opacity-80">You skipped this prediction phase.</p>
		</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-3">
			<label class="grid gap-1">
				<span class="text-sm font-semibold">Player</span>
				<select class="select" bind:value={selectedTarget}>
					<option value="" disabled>Select player</option>
					{#each targets as target}
						<option value={target.id}>{target.name}</option>
					{/each}
				</select>
			</label>
			<label class="grid gap-1">
				<span class="text-sm font-semibold">Predicted words</span>
				<input class="input" type="number" min="0" bind:value={predictedWords} />
			</label>
			<label class="grid gap-1">
				<span class="text-sm font-semibold">Stake</span>
				<input class="input" type="number" min="1" bind:value={stake} />
			</label>
		</div>
		<div class="flex gap-2">
			<button class="btn preset-filled-primary-500" onclick={onSubmit}>Submit Prediction</button>
			<button class="btn preset-tonal-surface" onclick={onSkip}>Skip</button>
		</div>
	{/if}
</section>
