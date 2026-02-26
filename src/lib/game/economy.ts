export type PredictionBet = {
	bettorId: string;
	targetPlayerId: string;
	predictedWords: number;
	stake: number;
};

export type PredictionSettlement = {
	adjustments: Map<string, number>;
	winnerIdsByTarget: Map<string, string[]>;
};

export function settlePredictionBets(
	bets: PredictionBet[],
	actualWordCounts: Map<string, number>
): PredictionSettlement {
	const byTarget = new Map<string, PredictionBet[]>();
	for (const bet of bets) {
		const list = byTarget.get(bet.targetPlayerId) ?? [];
		list.push(bet);
		byTarget.set(bet.targetPlayerId, list);
	}

	const adjustments = new Map<string, number>();
	const winnerIdsByTarget = new Map<string, string[]>();

	for (const [targetPlayerId, targetBets] of byTarget.entries()) {
		const actual = actualWordCounts.get(targetPlayerId) ?? 0;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const bet of targetBets) {
			const distance = Math.abs(actual - bet.predictedWords);
			if (distance < bestDistance) {
				bestDistance = distance;
			}
		}

		const winners = targetBets.filter((bet) => Math.abs(actual - bet.predictedWords) === bestDistance);
		winnerIdsByTarget.set(
			targetPlayerId,
			winners.map((winner) => winner.bettorId)
		);

		const winnerSet = new Set(winners.map((winner) => winner.bettorId));
		const losingPool = targetBets
			.filter((bet) => !winnerSet.has(bet.bettorId))
			.reduce((sum, bet) => sum + bet.stake, 0);

		if (losingPool <= 0) continue;

		const winnerPool = Math.floor(losingPool * 0.7);
		const targetPool = losingPool - winnerPool;

		const winnerDistribution = splitInteger(winnerPool, winners.length);
		for (let i = 0; i < winners.length; i += 1) {
			const bettorId = winners[i].bettorId;
			adjustments.set(bettorId, (adjustments.get(bettorId) ?? 0) + winnerDistribution[i]);
		}

		adjustments.set(targetPlayerId, (adjustments.get(targetPlayerId) ?? 0) + targetPool);
	}

	return { adjustments, winnerIdsByTarget };
}

export type DraftLetter = {
	id: string;
	letter: string;
};

export type AuctionBid = {
	playerId: string;
	letterId: string;
	stake: number;
};

export type AuctionSettlement = {
	awards: Map<string, string>;
	chargedBids: Map<string, number>;
};

export function settleLetterAuction(
	draftLetters: DraftLetter[],
	selections: Map<string, string>,
	bids: AuctionBid[]
): AuctionSettlement {
	const awards = new Map<string, string>();
	const chargedBids = new Map<string, number>();

	const selectorsByLetter = new Map<string, string[]>();
	for (const [playerId, letterId] of selections.entries()) {
		const current = selectorsByLetter.get(letterId) ?? [];
		current.push(playerId);
		selectorsByLetter.set(letterId, current);
	}

	const contestedLetterIds = new Set<string>();
	for (const letter of draftLetters) {
		const selectors = selectorsByLetter.get(letter.id) ?? [];
		if (selectors.length === 1) {
			awards.set(selectors[0], letter.letter);
		}
		if (selectors.length > 1) {
			contestedLetterIds.add(letter.id);
		}
	}

	const bidsByLetter = new Map<string, AuctionBid[]>();
	for (const bid of bids) {
		const list = bidsByLetter.get(bid.letterId) ?? [];
		list.push(bid);
		bidsByLetter.set(bid.letterId, list);
		chargedBids.set(bid.playerId, (chargedBids.get(bid.playerId) ?? 0) + bid.stake);
	}

	const letterLookup = new Map(draftLetters.map((letter) => [letter.id, letter.letter]));

	for (const letterId of contestedLetterIds) {
		const letter = letterLookup.get(letterId);
		if (!letter) continue;
		const letterBids = bidsByLetter.get(letterId) ?? [];
		if (!letterBids.length) {
			const selectors = selectorsByLetter.get(letterId) ?? [];
			for (const selectorId of selectors) {
				awards.set(selectorId, letter);
			}
			continue;
		}

		let bestBid = 0;
		for (const bid of letterBids) {
			if (bid.stake > bestBid) bestBid = bid.stake;
		}
		const winners = letterBids.filter((bid) => bid.stake === bestBid);
		for (const winner of winners) {
			awards.set(winner.playerId, letter);
		}
	}

	return { awards, chargedBids };
}

function splitInteger(total: number, count: number): number[] {
	if (count <= 0) return [];
	const base = Math.floor(total / count);
	const remainder = total % count;
	const result = Array(count).fill(base);
	for (let i = 0; i < remainder; i += 1) {
		result[i] += 1;
	}
	return result;
}
