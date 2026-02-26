<script lang="ts">
	import ConfettiBurst from './ConfettiBurst.svelte';
	import type { PlayerSnapshot } from '$lib/game/types';

	type Props = {
		players: PlayerSnapshot[];
		playerId: string | null;
		timeLabel: string;
	};

	let { players, playerId, timeLabel }: Props = $props();
</script>

<section class="card relative overflow-hidden p-4">
	<ConfettiBurst />
	<div class="mb-2">
		<span class="badge preset-tonal-surface">Round Complete</span>
	</div>
	<div class="mt-1 text-lg font-semibold">Final Time: {timeLabel}</div>
</section>

<section class="card p-4">
	<h2 class="mb-3 text-lg font-semibold">Leaderboard</h2>
	{#if players.length}
		<ul class="space-y-2">
			{#each players as player (player.id)}
				<li class="card flex items-center justify-between px-3 py-2">
					<div class="flex items-center gap-2">
						<span>{player.name}</span>
						{#if player.id === playerId}
							<span class="badge preset-filled-primary-500">You</span>
						{/if}
					</div>
					<span class="font-semibold">{player.score}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p>No scores yet.</p>
	{/if}
</section>
