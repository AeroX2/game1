<script lang="ts">
	import ConfettiBurst from './ConfettiBurst.svelte';
	import type { PlayerSnapshot } from '$lib/game/types';

	type Props = {
		round: number;
		totalRounds: number;
		players: PlayerSnapshot[];
		readyCount: number;
		totalPlayers: number;
		isReady: boolean;
		onContinue: () => void;
	};

	let { round, totalRounds, players, readyCount, totalPlayers, isReady, onContinue }: Props = $props();
</script>

<section class="card relative overflow-hidden p-4">
	<ConfettiBurst />
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-xl font-semibold">Round Results</h2>
		<span class="badge preset-tonal-surface">Round {round}/{totalRounds}</span>
	</div>
	<div class="mt-3 text-sm opacity-80">
		Ready to continue: <span class="font-semibold">{readyCount}/{totalPlayers}</span>
	</div>
</section>

<section class="card p-4">
	<h3 class="mb-3 text-lg font-semibold">Current Standings</h3>
	<ul class="space-y-2">
		{#each players as player (player.id)}
			<li class="card flex items-center justify-between px-3 py-2">
				<span>{player.name}</span>
				<div class="flex items-center gap-2">
					<span class="badge preset-tonal-surface">{player.roundWordCount} words</span>
					<span class="badge preset-tonal-surface">Board +{player.roundBoardPoints}</span>
					<span class="badge preset-tonal-surface">Prediction {player.roundPredictionPoints >= 0 ? '+' : ''}{player.roundPredictionPoints}</span>
					<span class="font-semibold">{player.score} pts</span>
				</div>
			</li>
		{/each}
	</ul>
</section>

<button class="btn preset-filled-primary-500" onclick={onContinue} disabled={isReady}>
	{#if isReady}
		Waiting for other players...
	{:else if round < totalRounds}
		Ready for Next Round
	{:else}
		Ready to Finish Match
	{/if}
</button>
