<script lang="ts">
	import { onDestroy } from 'svelte';
	import ActiveRoundScreen from '$lib/components/boggle/ActiveRoundScreen.svelte';
	import AuctionScreen from '$lib/components/boggle/AuctionScreen.svelte';
	import DraftScreen from '$lib/components/boggle/DraftScreen.svelte';
	import LobbyScreen from '$lib/components/boggle/LobbyScreen.svelte';
	import PregameScreen from '$lib/components/boggle/PregameScreen.svelte';
	import PredictionScreen from '$lib/components/boggle/PredictionScreen.svelte';
	import RoundResultsScreen from '$lib/components/boggle/RoundResultsScreen.svelte';
	import ResultsScreen from '$lib/components/boggle/ResultsScreen.svelte';
	import { createBogglePresenter } from '$lib/features/boggle/presenter';

	const presenter = createBogglePresenter();
	const { state: stores, actions } = presenter;
	const {
		name,
		roomCodeInput,
		roomId,
		playerId,
		state: roomState,
		wordInput,
		feedback,
		loading,
		timeLabel,
		screen,
		canSubmit,
		myPlayer,
		totalRoundsInput,
		predictionTargetPlayerId,
		predictionWordsInput,
		predictionStakeInput,
		selectedDraftLetterId,
		auctionStakeInput,
		toastMessage,
		toastTone,
		toastVisible,
		lastWordPath,
		availablePredictionTargets,
		myPredictionBet,
		myPredictionSkipped,
		auctionContestedLetter,
		myAuctionBid,
		myRoundReady
	} = stores;

	onDestroy(() => {
		actions.destroy();
	});

	let rulesOpen = $state(false);
</script>

<main class="mx-auto grid w-full max-w-2xl gap-4 px-4 py-6">
	<header class="card p-4">
		<div class="flex items-center justify-between gap-3">
			<h1 class="text-2xl font-bold">Realtime Boggle</h1>
			<span class="badge preset-tonal-surface">Multiplayer</span>
		</div>
		<p class="mt-2 text-sm opacity-80">Cloudflare Durable Objects + SvelteKit</p>
		<button
			class="mt-3 flex items-center gap-2 text-sm font-medium opacity-80 transition hover:opacity-100"
			onclick={() => (rulesOpen = !rulesOpen)}
			type="button"
		>
			<span>{rulesOpen ? '▼' : '▶'}</span>
			How to play
		</button>
		{#if rulesOpen}
			<div class="mt-3 space-y-3 border-t border-surface-300-700 pt-3 text-sm opacity-90">
				<div>
					<p class="font-semibold">Rounds</p>
					<p>Each round has a timed word-finding phase on a shared 5×5 letter grid. You can use one extra letter (off the grid) if you win it in the letter market.</p>
				</div>
				<div>
					<p class="font-semibold">Prediction</p>
					<p>Before the round, bet on how many words another player will find. You only win if they meet or exceed your prediction; the closest winning bet gets the pool plus a bonus.</p>
				</div>
				<div>
					<p class="font-semibold">Letter market</p>
					<p>Vote for which letter goes to auction. The letter with the most votes is auctioned (blind bid). Highest bidder gets that letter as their extra letter for the round. We keep voting and auctioning until everyone has an extra letter. If one letter and one player remain, that player gets it automatically.</p>
				</div>
				<div>
					<p class="font-semibold">Finding words</p>
					<p>Words must be at least 3 letters, in the dictionary, and formed by moving to adjacent cells (including diagonals). You may use your extra letter once per word in place of a cell. No reusing the same cell in one word.</p>
				</div>
				<div>
					<p class="font-semibold">Scoring</p>
					<p>Points per word: 3–4 letters = 1, 5 = 2, 6 = 3, 7 = 5, 8+ = 11. Prediction wins add stake back, your share of the losing pool, and a bonus equal to your stake.</p>
				</div>
			</div>
		{/if}
	</header>

	{#if $screen === 'lobby' && !$roomId}
		<LobbyScreen bind:name={$name} bind:roomCodeInput={$roomCodeInput} loading={$loading} onCreateRoom={actions.createRoom} onJoinRoom={actions.joinRoom} />
	{:else if $screen === 'lobby'}
		<PregameScreen
			roomId={$roomId ?? ''}
			bind:totalRounds={$totalRoundsInput}
			players={$roomState?.players ?? []}
			onConfigureRounds={actions.configureRounds}
			onStartRound={actions.startRound}
		/>
	{:else if $screen === 'prediction'}
		<PredictionScreen
			round={$roomState?.currentRound ?? 0}
			totalRounds={$roomState?.totalRounds ?? 0}
			timeLabel={$timeLabel}
			score={$myPlayer?.score ?? 0}
			targets={($availablePredictionTargets ?? []).map((player) => ({ id: player.id, name: player.name }))}
			bind:selectedTarget={$predictionTargetPlayerId}
			bind:predictedWords={$predictionWordsInput}
			bind:stake={$predictionStakeInput}
			myBet={$myPredictionBet}
			mySkipped={$myPredictionSkipped}
			onSubmit={actions.submitPredictionBet}
			onSkip={actions.submitPredictionSkip}
		/>
	{:else if $screen === 'draft'}
		<DraftScreen
			letters={$roomState?.draftLetters ?? []}
			timeLabel={$timeLabel}
			bind:selectedLetterId={$selectedDraftLetterId}
			alreadyHaveExtraLetter={($myPlayer?.extraLetter ?? null) != null}
			onSubmit={(letterId) => actions.submitDraftPick(letterId)}
		/>
	{:else if $screen === 'auction'}
		<AuctionScreen
			score={$myPlayer?.score ?? 0}
			timeLabel={$timeLabel}
			contestedLetter={$auctionContestedLetter}
			bind:stake={$auctionStakeInput}
			myBid={$myAuctionBid}
			alreadyHaveExtraLetter={($myPlayer?.extraLetter ?? null) != null}
			onSubmit={actions.submitAuctionBid}
		/>
	{:else if $screen === 'active'}
		<ActiveRoundScreen
			timeLabel={$timeLabel}
			round={$roomState?.currentRound ?? 0}
			totalRounds={$roomState?.totalRounds ?? 0}
			score={$myPlayer?.score ?? 0}
			players={$roomState?.players ?? []}
			playerId={$playerId}
			myPrediction={$myPredictionBet}
			predictionSkipped={$myPredictionSkipped}
			extraLetter={$myPlayer?.extraLetter ?? null}
			bind:wordInput={$wordInput}
			canSubmit={$canSubmit}
			myWords={$myPlayer?.words ?? []}
			board={$roomState?.board ?? []}
			highlightPath={$lastWordPath}
			onSubmitWord={actions.submitWord}
		/>
	{:else if $screen === 'round_results'}
		<RoundResultsScreen
			round={$roomState?.currentRound ?? 0}
			totalRounds={$roomState?.totalRounds ?? 0}
			players={$roomState?.players ?? []}
			readyCount={$roomState?.roundReadyPlayerIds.length ?? 0}
			totalPlayers={$roomState?.players.length ?? 0}
			isReady={$myRoundReady}
			onContinue={actions.startRound}
		/>
	{:else}
		<ResultsScreen
			players={$roomState?.players ?? []}
			playerId={$playerId}
			timeLabel={`Rounds: ${$roomState?.totalRounds ?? 0}`}
		/>
	{/if}

	{#if $feedback}
		<div class="card flex items-center gap-2 p-3 text-sm transition-all duration-300">
			<span class="badge preset-filled-secondary-500">Notice</span>
			<span>{$feedback}</span>
		</div>
	{/if}

	{#if $toastVisible}
		<div class="pointer-events-none fixed right-4 top-4 z-50">
			<div
				class={`card pointer-events-auto min-w-72 p-3 text-sm shadow-xl ${
					$toastTone === 'success'
						? 'preset-filled-success-500'
						: $toastTone === 'warning'
							? 'preset-filled-warning-500'
							: 'preset-filled-secondary-500'
				}`}
				role="status"
				aria-live="polite"
			>
				<div class="flex items-center justify-between gap-2">
					<span class="badge preset-tonal-surface">Letter Market</span>
					<span class="opacity-80">Now</span>
				</div>
				<p class="mt-1">{$toastMessage}</p>
			</div>
		</div>
	{/if}
</main>
