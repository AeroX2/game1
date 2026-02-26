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
		// Only bets where actual >= predicted (target met or exceeded prediction) are eligible to win
		const eligibleBets = targetBets.filter((bet) => actual >= bet.predictedWords);
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const bet of eligibleBets) {
			const distance = Math.abs(actual - bet.predictedWords);
			if (distance < bestDistance) {
				bestDistance = distance;
			}
		}

		const winners = eligibleBets.filter(
			(bet) => Math.abs(actual - bet.predictedWords) === bestDistance
		);
		winnerIdsByTarget.set(
			targetPlayerId,
			winners.map((winner) => winner.bettorId)
		);

		if (winners.length === 0) continue;

		const winnerSet = new Set(winners.map((winner) => winner.bettorId));
		const losingPool = targetBets
			.filter((bet) => !winnerSet.has(bet.bettorId))
			.reduce((sum, bet) => sum + bet.stake, 0);

		// Winners get: their stake back + full losing pool (split) + bonus (equal to their stake)
		const poolShare = splitInteger(losingPool, winners.length);
		for (let i = 0; i < winners.length; i += 1) {
			const bet = winners[i];
			const stakeBack = bet.stake;
			const bonus = bet.stake;
			const total = stakeBack + poolShare[i] + bonus;
			adjustments.set(
				bet.bettorId,
				(adjustments.get(bet.bettorId) ?? 0) + total
			);
		}
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
