<script lang="ts">
	type Props = {
		roomId: string;
		totalRounds: number;
		players: Array<{ id: string; name: string; score: number }>;
		onConfigureRounds: () => void;
		onStartRound: () => void;
	};

	let {
		roomId,
		totalRounds = $bindable(3),
		players,
		onConfigureRounds,
		onStartRound
	}: Props = $props();
</script>

<section class="card space-y-4 p-4">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-xl font-semibold">Match Setup</h2>
		<span class="badge preset-tonal-surface">Lobby</span>
	</div>
	<div class="grid gap-3 sm:grid-cols-2">
		<div class="card p-3">
			<p class="mb-2">
				<span class="badge preset-tonal-surface">Room</span>
			</p>
			<p class="text-2xl font-bold tracking-widest">{roomId}</p>
		</div>
		<div class="card p-3">
			<p class="mb-2">
				<span class="badge preset-tonal-surface">Players</span>
			</p>
			<p class="text-lg font-medium">{players.length}</p>
		</div>
	</div>

	<div class="card grid gap-3 p-3 sm:grid-cols-[1fr_auto]">
		<label class="grid gap-1">
			<span class="text-sm font-semibold">Total Rounds</span>
			<input class="input" type="number" min="1" max="12" bind:value={totalRounds} />
		</label>
		<button class="btn preset-tonal-surface self-end" onclick={onConfigureRounds}>Save Rounds</button>
	</div>

	<button class="btn preset-filled-primary-500" onclick={onStartRound}>Begin Match</button>
</section>
