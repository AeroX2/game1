import type { RoomEvent, RoomSnapshot, SubmitResult } from '$lib/game/types';

export type CreateJoinResponse = {
	roomId: string;
	playerId: string;
	state: RoomSnapshot;
};

type ErrorResponse = {
	error: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isRoomSnapshot(value: unknown): value is RoomSnapshot {
	if (!isRecord(value)) return false;
	if (typeof value.roomId !== 'string') return false;
	if (!Array.isArray(value.board) || !value.board.every((cell) => typeof cell === 'string')) return false;
	if (value.status !== 'lobby' && value.status !== 'active' && value.status !== 'finished') return false;
	if (
		value.phase !== 'lobby' &&
		value.phase !== 'prediction' &&
		value.phase !== 'letter_draft' &&
		value.phase !== 'letter_auction' &&
		value.phase !== 'active' &&
		value.phase !== 'round_results' &&
		value.phase !== 'finished'
	) {
		return false;
	}
	if (typeof value.totalRounds !== 'number') return false;
	if (typeof value.currentRound !== 'number') return false;
	if (value.startedAt !== null && typeof value.startedAt !== 'number') return false;
	if (value.endsAt !== null && typeof value.endsAt !== 'number') return false;
	if (!Array.isArray(value.players)) return false;
	if (!Array.isArray(value.draftLetters)) return false;
	if (!Array.isArray(value.contestedLetterIds)) return false;
	if (value.currentAuctionLetterId !== null && typeof value.currentAuctionLetterId !== 'string') return false;
	if (!Array.isArray(value.predictionBets)) return false;
	if (!Array.isArray(value.predictionSkips)) return false;
	if (!Array.isArray(value.auctionBids)) return false;
	if (!Array.isArray(value.roundReadyPlayerIds)) return false;

	const playersValid = value.players.every((player) => {
		if (!isRecord(player)) return false;
		if (typeof player.id !== 'string') return false;
		if (typeof player.name !== 'string') return false;
		if (typeof player.score !== 'number') return false;
		if (player.extraLetter !== null && typeof player.extraLetter !== 'string') return false;
		if (typeof player.roundWordCount !== 'number') return false;
		if (typeof player.roundBoardPoints !== 'number') return false;
		if (typeof player.roundPredictionPoints !== 'number') return false;
		if (!Array.isArray(player.words)) return false;
		return player.words.every((word) => typeof word === 'string');
	});

	if (!playersValid) return false;

	if (
		!value.draftLetters.every((entry) => {
			if (!isRecord(entry)) return false;
			if (typeof entry.id !== 'string') return false;
			return typeof entry.letter === 'string';
		})
	) {
		return false;
	}

	if (!value.contestedLetterIds.every((entry) => typeof entry === 'string')) {
		return false;
	}
	if (!value.predictionSkips.every((entry) => typeof entry === 'string')) {
		return false;
	}
	if (!value.roundReadyPlayerIds.every((entry) => typeof entry === 'string')) {
		return false;
	}

	if (
		!value.predictionBets.every((entry) => {
			if (!isRecord(entry)) return false;
			if (typeof entry.bettorId !== 'string') return false;
			if (typeof entry.targetPlayerId !== 'string') return false;
			if (typeof entry.predictedWords !== 'number') return false;
			return typeof entry.stake === 'number';
		})
	) {
		return false;
	}

	return value.auctionBids.every((entry) => {
		if (!isRecord(entry)) return false;
		if (typeof entry.playerId !== 'string') return false;
		if (typeof entry.letterId !== 'string') return false;
		return typeof entry.stake === 'number';
	});
}

export function isCreateJoinResponse(value: unknown): value is CreateJoinResponse {
	if (!isRecord(value)) return false;
	if (typeof value.roomId !== 'string') return false;
	if (typeof value.playerId !== 'string') return false;
	return isRoomSnapshot(value.state);
}

export function isSubmitResult(value: unknown): value is SubmitResult {
	if (!isRecord(value)) return false;
	if (typeof value.ok !== 'boolean') return false;
	if (typeof value.message !== 'string') return false;
	if ('scoreDelta' in value && value.scoreDelta !== undefined && typeof value.scoreDelta !== 'number') {
		return false;
	}
	if ('word' in value && value.word !== undefined && typeof value.word !== 'string') {
		return false;
	}
	if ('state' in value && value.state !== undefined && !isRoomSnapshot(value.state)) {
		return false;
	}
	return true;
}

export function parseErrorResponse(value: unknown): ErrorResponse | null {
	if (!isRecord(value)) return null;
	if (typeof value.error !== 'string') return null;
	return { error: value.error };
}

export function parseRoomEvent(data: unknown): RoomEvent | null {
	if (typeof data !== 'string') return null;

	try {
		const parsed = JSON.parse(data);
		if (!isRecord(parsed)) return null;
		if (parsed.type === 'error' && typeof parsed.message === 'string') {
			return { type: 'error', message: parsed.message };
		}
		if (parsed.type === 'state' && isRoomSnapshot(parsed.state)) {
			return { type: 'state', state: parsed.state };
		}
		return null;
	} catch {
		return null;
	}
}
