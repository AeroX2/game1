import { browser } from '$app/environment';
import type { PlayerSnapshot, RoomSnapshot } from '$lib/game/types';
import { derived, get, writable } from 'svelte/store';
import {
	isCreateJoinResponse,
	isRoomSnapshot,
	isSubmitResult,
	parseErrorResponse,
	parseRoomEvent
} from './parsers';

type Screen = 'lobby' | 'prediction' | 'draft' | 'auction' | 'active' | 'round_results' | 'results';
type ToastTone = 'info' | 'success' | 'warning';

function formatMs(ms: number): string {
	const total = Math.ceil(ms / 1000);
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function createBogglePresenter() {
	const name = writable('');
	const roomCodeInput = writable('');
	const roomId = writable<string | null>(null);
	const playerId = writable<string | null>(null);
	const state = writable<RoomSnapshot | null>(null);
	const wordInput = writable('');
	const feedback = writable('');
	const loading = writable(false);
	const remainingMs = writable(0);
	const totalRoundsInput = writable(3);
	const predictionTargetPlayerId = writable('');
	const predictionWordsInput = writable(3);
	const predictionStakeInput = writable(1);
	const selectedDraftLetterId = writable('');
	const auctionStakeInput = writable(0);
	const toastMessage = writable('');
	const toastTone = writable<ToastTone>('info');
	const toastVisible = writable(false);
	const lastWordPath = writable<number[] | null>(null);

	let socket: WebSocket | null = null;
	let ticker: ReturnType<typeof setInterval> | null = null;
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let toastToken = 0;

	const timeLabel = derived(remainingMs, ($remainingMs) => formatMs($remainingMs));

	const screen = derived([roomId, state], ([$roomId, $state]): Screen => {
		if (!$roomId || !$state) return 'lobby';
		if ($state.phase === 'prediction') return 'prediction';
		if ($state.phase === 'letter_draft') return 'draft';
		if ($state.phase === 'letter_auction') return 'auction';
		if ($state.phase === 'active') return 'active';
		if ($state.phase === 'round_results') return 'round_results';
		if ($state.phase === 'finished') return 'results';
		return 'lobby';
	});

	const canSubmit = derived(
		[playerId, roomId, state, wordInput, remainingMs],
		([$playerId, $roomId, $state, $wordInput, $remainingMs]) =>
			Boolean($playerId && $roomId) &&
			$state?.phase === 'active' &&
			$wordInput.trim().length >= 3 &&
			$remainingMs > 0
	);

	const myPlayer = derived([state, playerId], ([$state, $playerId]): PlayerSnapshot | null => {
		if (!$state || !$playerId) return null;
		return $state.players.find((player) => player.id === $playerId) ?? null;
	});

	const availablePredictionTargets = derived([state, playerId], ([$state, $playerId]) => {
		if (!$state || !$playerId) return [];
		return $state.players.filter((player) => player.id !== $playerId);
	});

	const myPredictionBet = derived([state, playerId], ([$state, $playerId]) => {
		if (!$state || !$playerId) return null;
		return $state.predictionBets.find((entry) => entry.bettorId === $playerId) ?? null;
	});

	const myPredictionSkipped = derived([state, playerId], ([$state, $playerId]) => {
		if (!$state || !$playerId) return false;
		return $state.predictionSkips.includes($playerId);
	});

	const auctionContestedLetter = derived(state, ($state) => {
		if (!$state || !$state.currentAuctionLetterId) return null;
		return $state.draftLetters.find((entry) => entry.id === $state.currentAuctionLetterId)?.letter ?? null;
	});

	const myAuctionBid = derived([state, playerId], ([$state, $playerId]) => {
		if (!$state || !$playerId) return null;
		return $state.auctionBids.find((entry) => entry.playerId === $playerId) ?? null;
	});

	const myRoundReady = derived([state, playerId], ([$state, $playerId]) => {
		if (!$state || !$playerId) return false;
		return $state.roundReadyPlayerIds.includes($playerId);
	});

	function applyState(next: RoomSnapshot) {
		state.set(next);
		totalRoundsInput.set(next.totalRounds);
		const me = get(playerId);
		if (me && !get(predictionTargetPlayerId)) {
			const fallback = next.players.find((player) => player.id !== me)?.id ?? '';
			predictionTargetPlayerId.set(fallback);
		}
		updateRemaining();
	}

	function updateRemaining() {
		const currentState = get(state);
		const end = currentState?.endsAt;
		if (!end) {
			remainingMs.set(0);
			return;
		}
		remainingMs.set(Math.max(0, end - Date.now()));
	}

	function connectSocket() {
		if (!browser) return;
		const currentRoomId = get(roomId);
		const currentPlayerId = get(playerId);
		if (!currentRoomId || !currentPlayerId) return;

		socket?.close();

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const socketUrl = `${protocol}//${window.location.host}/api/rooms/${currentRoomId}/ws?playerId=${currentPlayerId}`;
		socket = new WebSocket(socketUrl);

		socket.addEventListener('message', (event) => {
			const payload = parseRoomEvent(event.data);
			if (!payload) return;
			if (payload.type === 'state') {
				applyState(payload.state);
			}
			if (payload.type === 'error') {
				feedback.set(payload.message);
			}
		});

		socket.addEventListener('close', () => {
			socket = null;
		});
	}

	function showToast(message: string, tone: ToastTone = 'info', durationMs = 2800) {
		toastMessage.set(message);
		toastTone.set(tone);
		toastVisible.set(true);

		toastToken += 1;
		const token = toastToken;
		if (toastTimer) {
			clearTimeout(toastTimer);
		}
		if (!browser) return;
		toastTimer = setTimeout(() => {
			if (token === toastToken) {
				toastVisible.set(false);
			}
		}, durationMs);
	}

	async function createRoom() {
		loading.set(true);
		feedback.set('');
		try {
			const res = await fetch('/api/rooms/create', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: get(name) })
			});
			const payload = await res.json();
			if (!isCreateJoinResponse(payload)) {
				feedback.set('Unexpected response while creating room.');
				return;
			}
			roomId.set(payload.roomId);
			playerId.set(payload.playerId);
			applyState(payload.state);
			connectSocket();
			feedback.set(`Created room ${payload.roomId}`);
		} finally {
			loading.set(false);
		}
	}

	async function joinRoom() {
		loading.set(true);
		feedback.set('');
		try {
			const code = get(roomCodeInput).trim().toUpperCase();
			const res = await fetch('/api/rooms/join', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ roomId: code, name: get(name) })
			});
			const payload = await res.json();
			if (!res.ok) {
				const errorPayload = parseErrorResponse(payload);
				feedback.set(errorPayload?.error ?? 'Unable to join room.');
				return;
			}
			if (!isCreateJoinResponse(payload)) {
				feedback.set('Unexpected response while joining room.');
				return;
			}
			roomId.set(payload.roomId);
			playerId.set(payload.playerId);
			applyState(payload.state);
			connectSocket();
			feedback.set(`Joined room ${payload.roomId}`);
		} finally {
			loading.set(false);
		}
	}

	async function startRound() {
		const currentRoomId = get(roomId);
		if (!currentRoomId) return;
		const currentPlayerId = get(playerId);
		const before = get(state);

		const res = await fetch(`/api/rooms/${currentRoomId}/start`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				totalRounds: get(totalRoundsInput),
				playerId: currentPlayerId
			})
		});
		const payload = await res.json();
		if (!res.ok) {
			const errorPayload = parseErrorResponse(payload);
			feedback.set(errorPayload?.error ?? 'Could not advance game phase.');
			return;
		}
		if (!payload || typeof payload !== 'object' || !('state' in payload) || !payload.state) {
			feedback.set('Unexpected start response.');
			return;
		}
		if (!isRoomSnapshot(payload.state)) {
			feedback.set('Unexpected round state.');
			return;
		}
		const nextState: RoomSnapshot = payload.state;
		if (before?.phase === 'round_results' && nextState.phase === 'round_results' && currentPlayerId) {
			const readyCount = nextState.roundReadyPlayerIds.length;
			const totalPlayers = nextState.players.length;
			if (nextState.roundReadyPlayerIds.includes(currentPlayerId)) {
				feedback.set(`Ready up saved (${readyCount}/${totalPlayers}).`);
			} else {
				feedback.set(`Waiting for players (${readyCount}/${totalPlayers}).`);
			}
		} else {
			feedback.set('Advanced game phase.');
		}
		applyState(nextState);
	}

	async function configureRounds() {
		const currentRoomId = get(roomId);
		if (!currentRoomId) return;
		const totalRounds = Math.max(1, Math.floor(get(totalRoundsInput)));
		const res = await fetch(`/api/rooms/${currentRoomId}/configure-rounds`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ totalRounds })
		});
		const payload = await res.json();
		if (!res.ok) {
			const errorPayload = parseErrorResponse(payload);
			feedback.set(errorPayload?.error ?? 'Could not configure rounds.');
			return;
		}
		if (!payload || typeof payload !== 'object' || !('state' in payload) || !payload.state) {
			feedback.set('Unexpected configure response.');
			return;
		}
		if (!isRoomSnapshot(payload.state)) {
			feedback.set('Unexpected room state.');
			return;
		}
		feedback.set(`Set total rounds to ${totalRounds}.`);
		applyState(payload.state);
	}

	async function submitPredictionBet() {
		const currentRoomId = get(roomId);
		const currentPlayerId = get(playerId);
		if (!currentRoomId || !currentPlayerId) return;

		const res = await fetch(`/api/rooms/${currentRoomId}/prediction-bet`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				bettorId: currentPlayerId,
				targetPlayerId: get(predictionTargetPlayerId),
				predictedWords: Math.max(0, Math.floor(get(predictionWordsInput))),
				stake: Math.max(1, Math.floor(get(predictionStakeInput)))
			})
		});
		const payload = await res.json();
		if (!res.ok) {
			const errorPayload = parseErrorResponse(payload);
			feedback.set(errorPayload?.error ?? 'Could not submit prediction bet.');
			return;
		}
		if (!payload || typeof payload !== 'object' || !('state' in payload) || !payload.state) {
			feedback.set('Unexpected prediction response.');
			return;
		}
		if (!isRoomSnapshot(payload.state)) {
			feedback.set('Unexpected room state.');
			return;
		}
		feedback.set('Prediction bet submitted.');
		applyState(payload.state);
	}

	async function submitPredictionSkip() {
		const currentRoomId = get(roomId);
		const currentPlayerId = get(playerId);
		if (!currentRoomId || !currentPlayerId) return;

		const res = await fetch(`/api/rooms/${currentRoomId}/prediction-bet`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				bettorId: currentPlayerId,
				skip: true
			})
		});
		const payload = await res.json();
		if (!res.ok) {
			const errorPayload = parseErrorResponse(payload);
			feedback.set(errorPayload?.error ?? 'Could not skip prediction.');
			return;
		}
		if (!payload || typeof payload !== 'object' || !('state' in payload) || !payload.state) {
			feedback.set('Unexpected prediction skip response.');
			return;
		}
		if (!isRoomSnapshot(payload.state)) {
			feedback.set('Unexpected room state.');
			return;
		}
		feedback.set('Prediction skipped.');
		applyState(payload.state);
	}

	async function submitDraftPick(pickedLetterId?: string) {
		const currentRoomId = get(roomId);
		const currentPlayerId = get(playerId);
		if (!currentRoomId || !currentPlayerId) return;
		const letterId = pickedLetterId ?? get(selectedDraftLetterId);
		if (!letterId) {
			feedback.set('Choose a letter first.');
			return;
		}
		selectedDraftLetterId.set(letterId);

		const before = get(state);
		const res = await fetch(`/api/rooms/${currentRoomId}/draft-pick`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ playerId: currentPlayerId, letterId })
		});
		const payload = await res.json();
		if (!res.ok) {
			const errorPayload = parseErrorResponse(payload);
			feedback.set(errorPayload?.error ?? 'Could not submit letter pick.');
			return;
		}
		if (!payload || typeof payload !== 'object' || !('state' in payload) || !payload.state) {
			feedback.set('Unexpected draft response.');
			return;
		}
		if (!isRoomSnapshot(payload.state)) {
			feedback.set('Unexpected room state.');
			return;
		}
		const nextState: RoomSnapshot = payload.state;
		const meAfter = nextState.players.find((player: PlayerSnapshot) => player.id === currentPlayerId) ?? null;
		const meBefore = before?.players.find((player) => player.id === currentPlayerId) ?? null;
		if (
			before?.phase === 'letter_draft' &&
			nextState.phase !== 'letter_draft' &&
			!meBefore?.extraLetter &&
			meAfter?.extraLetter
		) {
			feedback.set(`Nice! You secured letter ${meAfter.extraLetter}.`);
			showToast(`Extra letter unlocked: ${meAfter.extraLetter}`, 'success');
		} else {
			feedback.set('Letter pick submitted.');
		}
		applyState(nextState);
	}

	async function submitAuctionBid() {
		const currentRoomId = get(roomId);
		const currentPlayerId = get(playerId);
		if (!currentRoomId || !currentPlayerId) return;
		const stake = Math.max(0, Math.floor(get(auctionStakeInput)));

		const before = get(state);
		const res = await fetch(`/api/rooms/${currentRoomId}/auction-bid`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ playerId: currentPlayerId, stake })
		});
		const payload = await res.json();
		if (!res.ok) {
			const errorPayload = parseErrorResponse(payload);
			feedback.set(errorPayload?.error ?? 'Could not submit auction bid.');
			return;
		}
		if (!payload || typeof payload !== 'object' || !('state' in payload) || !payload.state) {
			feedback.set('Unexpected auction response.');
			return;
		}
		if (!isRoomSnapshot(payload.state)) {
			feedback.set('Unexpected room state.');
			return;
		}
		const nextState: RoomSnapshot = payload.state;
		const meAfter = nextState.players.find((player: PlayerSnapshot) => player.id === currentPlayerId) ?? null;
		const meBefore = before?.players.find((player) => player.id === currentPlayerId) ?? null;
		const auctionedLetter =
			before?.currentAuctionLetterId
				? before.draftLetters.find((entry) => entry.id === before.currentAuctionLetterId)?.letter
				: null;
		if (
			before?.phase === 'letter_auction' &&
			nextState.phase !== 'letter_auction' &&
			!meBefore?.extraLetter &&
			meAfter?.extraLetter
		) {
			if (auctionedLetter && meAfter.extraLetter === auctionedLetter) {
				feedback.set(`Auction won! You earned letter ${meAfter.extraLetter}.`);
				showToast(`Auction won: ${meAfter.extraLetter}`, 'success');
			} else {
				feedback.set(`Auction resolved. You received letter ${meAfter.extraLetter}.`);
				showToast(`No auction win, fallback letter: ${meAfter.extraLetter}`, 'warning');
			}
		} else {
			feedback.set(stake > 0 ? 'Auction bid submitted.' : 'Auction pass submitted.');
		}
		applyState(nextState);
	}

	async function submitWord() {
		const currentRoomId = get(roomId);
		const currentPlayerId = get(playerId);
		const allowed = get(canSubmit);
		if (!currentRoomId || !currentPlayerId || !allowed) return;

		const word = get(wordInput);
		wordInput.set('');

		const res = await fetch(`/api/rooms/${currentRoomId}/submit`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ playerId: currentPlayerId, word })
		});
		const payload = await res.json();
		if (!isSubmitResult(payload)) {
			feedback.set('Unexpected submit response.');
			return;
		}
		feedback.set(payload.message);
		if (payload.path && payload.path.length > 0) {
			lastWordPath.set(payload.path);
			setTimeout(() => lastWordPath.set(null), 1200);
		}
		if (payload.state) {
			applyState(payload.state);
		}
	}

	if (browser) {
		ticker = setInterval(updateRemaining, 250);
	}

	function destroy() {
		socket?.close();
		if (ticker) {
			clearInterval(ticker);
			ticker = null;
		}
		if (toastTimer) {
			clearTimeout(toastTimer);
			toastTimer = null;
		}
	}

	return {
		state: {
			name,
			roomCodeInput,
			roomId,
			playerId,
			state,
			wordInput,
			feedback,
			loading,
			remainingMs,
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
		},
		actions: {
			createRoom,
			joinRoom,
			startRound,
			configureRounds,
			submitPredictionBet,
			submitPredictionSkip,
			submitDraftPick,
			submitAuctionBid,
			submitWord,
			destroy
		}
	};
}
