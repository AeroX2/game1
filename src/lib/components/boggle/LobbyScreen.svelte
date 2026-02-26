<script lang="ts">
	type Props = {
		name: string;
		roomCodeInput: string;
		loading: boolean;
		onCreateRoom: () => void;
		onJoinRoom: () => void;
	};

	let { name = $bindable(''), roomCodeInput = $bindable(''), loading, onCreateRoom, onJoinRoom }: Props =
		$props();
</script>

<section class="card space-y-4 p-4">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-xl font-semibold">Join a Match</h2>
		<span class="badge preset-tonal-surface">Lobby</span>
	</div>
	<p class="text-sm opacity-80">Create a room or join with a room code.</p>

	<label class="grid gap-1">
		<span class="text-sm font-semibold">Name</span>
		<input class="input w-full" bind:value={name} maxlength="24" placeholder="Player name" />
	</label>

	<div class="grid gap-2 sm:grid-cols-2">
		<button class="btn preset-filled-primary-500 w-full" onclick={onCreateRoom} disabled={loading}>
			Create Room
		</button>
		<div class="flex gap-2">
			<input class="input w-full uppercase" bind:value={roomCodeInput} maxlength="8" placeholder="ROOMCODE" />
			<button class="btn preset-tonal-surface" onclick={onJoinRoom} disabled={loading}>Join</button>
		</div>
	</div>
</section>
