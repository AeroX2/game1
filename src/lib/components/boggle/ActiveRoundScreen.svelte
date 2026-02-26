<script lang="ts">
	import BoardGrid from './BoardGrid.svelte';

	type Props = {
		timeLabel: string;
		round: number;
		totalRounds: number;
		score: number;
		players: Array<{ id: string; name: string; score: number }>;
		playerId: string | null;
		myPrediction: { targetPlayerId: string; predictedWords: number; stake: number } | null;
		predictionSkipped: boolean;
		extraLetter: string | null;
		wordInput: string;
		canSubmit: boolean;
		myWords: string[];
		board: string[];
		onSubmitWord: () => void;
	};

	let {
		timeLabel,
		round,
		totalRounds,
		score,
		players,
		playerId,
		myPrediction,
		predictionSkipped,
		extraLetter,
		wordInput = $bindable(''),
		canSubmit,
		myWords,
		board,
		onSubmitWord
	}: Props = $props();
</script>

<section class="card p-4">
	<div class="mb-2 flex items-center gap-2">
		<span class="badge preset-tonal-surface">Time Remaining</span>
		<span class="badge preset-tonal-surface">Round {round}/{totalRounds}</span>
		{#if extraLetter}
			<span class="badge preset-filled-secondary-500">Extra Letter: {extraLetter}</span>
		{/if}
	</div>
	<div class="text-3xl font-bold tabular-nums">{timeLabel}</div>
	<div class="mt-2">
		<span class="badge preset-filled-primary-500">Score: {score}</span>
	</div>
</section>

<section class="card space-y-3 p-4">
	<div>
		<p class="mb-2">
			<span class="badge preset-tonal-surface">Your Prediction</span>
		</p>
		{#if myPrediction}
			<p class="text-sm">
				{myPrediction.predictedWords} words, stake {myPrediction.stake}
			</p>
		{:else if predictionSkipped}
			<p class="text-sm opacity-80">You skipped prediction this round.</p>
		{:else}
			<p class="text-sm opacity-80">No prediction recorded.</p>
		{/if}
	</div>
	<div>
		<p class="mb-2">
			<span class="badge preset-tonal-surface">Your Words</span>
		</p>
		{#if myWords.length}
			<div class="flex flex-wrap gap-2">
				{#each myWords as word}
					<span class="badge preset-filled-primary-500">{word}</span>
				{/each}
			</div>
		{:else}
			<p class="text-sm opacity-80">No words submitted yet.</p>
		{/if}
	</div>
	<div class="flex gap-2">
		<input
			class="input w-full"
			bind:value={wordInput}
			placeholder="Type a word"
			onkeydown={(event) => event.key === 'Enter' && onSubmitWord()}
		/>
		<button class="btn preset-filled-primary-500" onclick={onSubmitWord} disabled={!canSubmit}>Submit</button>
	</div>
</section>

<section class="card p-4">
	<p class="mb-2">
		<span class="badge preset-tonal-surface">Live Scoreboard</span>
	</p>
	<ul class="space-y-2">
		{#each players as player}
			<li class="card flex items-center justify-between px-3 py-2 transition-all duration-300">
				<div class="flex items-center gap-2">
					<span>{player.name}</span>
					{#if player.id === playerId}
						<span class="badge preset-filled-secondary-500">You</span>
					{/if}
				</div>
				<span class="font-semibold">{player.score}</span>
			</li>
		{/each}
	</ul>
</section>

<BoardGrid {board} />
