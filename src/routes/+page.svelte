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
		state,
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
</script>

<main class="mx-auto grid w-full max-w-2xl gap-4 px-4 py-6">
	<header class="card p-4">
		<div class="flex items-center justify-between gap-3">
			<h1 class="text-2xl font-bold">Realtime Boggle</h1>
			<span class="badge preset-tonal-surface">Multiplayer</span>
		</div>
		<p class="mt-2 text-sm opacity-80">Cloudflare Durable Objects + SvelteKit</p>
	</header>

	{#if $screen === 'lobby' && !$roomId}
		<LobbyScreen bind:name={$name} bind:roomCodeInput={$roomCodeInput} loading={$loading} onCreateRoom={actions.createRoom} onJoinRoom={actions.joinRoom} />
	{:else if $screen === 'lobby'}
		<PregameScreen
			roomId={$roomId ?? ''}
			bind:totalRounds={$totalRoundsInput}
			players={$state?.players ?? []}
			onConfigureRounds={actions.configureRounds}
			onStartRound={actions.startRound}
		/>
	{:else if $screen === 'prediction'}
		<PredictionScreen
			round={$state?.currentRound ?? 0}
			totalRounds={$state?.totalRounds ?? 0}
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
			letters={$state?.draftLetters ?? []}
			timeLabel={$timeLabel}
			bind:selectedLetterId={$selectedDraftLetterId}
			onSubmit={actions.submitDraftPick}
		/>
	{:else if $screen === 'auction'}
		<AuctionScreen
			score={$myPlayer?.score ?? 0}
			timeLabel={$timeLabel}
			contestedLetter={$auctionContestedLetter}
			bind:stake={$auctionStakeInput}
			myBid={$myAuctionBid}
			onSubmit={actions.submitAuctionBid}
		/>
	{:else if $screen === 'active'}
		<ActiveRoundScreen
			timeLabel={$timeLabel}
			round={$state?.currentRound ?? 0}
			totalRounds={$state?.totalRounds ?? 0}
			score={$myPlayer?.score ?? 0}
			players={$state?.players ?? []}
			playerId={$playerId}
			myPrediction={$myPredictionBet}
			predictionSkipped={$myPredictionSkipped}
			extraLetter={$myPlayer?.extraLetter ?? null}
			bind:wordInput={$wordInput}
			canSubmit={$canSubmit}
			myWords={$myPlayer?.words ?? []}
			board={$state?.board ?? []}
			onSubmitWord={actions.submitWord}
		/>
	{:else if $screen === 'round_results'}
		<RoundResultsScreen
			round={$state?.currentRound ?? 0}
			totalRounds={$state?.totalRounds ?? 0}
			players={$state?.players ?? []}
			readyCount={$state?.roundReadyPlayerIds.length ?? 0}
			totalPlayers={$state?.players.length ?? 0}
			isReady={$myRoundReady}
			onContinue={actions.startRound}
		/>
	{:else}
		<ResultsScreen
			players={$state?.players ?? []}
			playerId={$playerId}
			timeLabel={`Rounds: ${$state?.totalRounds ?? 0}`}
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
