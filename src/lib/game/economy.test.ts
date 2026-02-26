import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { settleLetterAuction, settlePredictionBets } from './economy';

describe('prediction settlement', () => {
	it('winners get stake back + full losing pool + bonus (bonus = stake)', () => {
		// actual 2. Eligible: p2 (pred 2), p4 (pred 1). Closest: p2 (distance 0). Winner: p2. Losers: p1, p4. Losing pool = 20.
		const settlement = settlePredictionBets(
			[
				{ bettorId: 'p1', targetPlayerId: 'p3', predictedWords: 5, stake: 10 },
				{ bettorId: 'p2', targetPlayerId: 'p3', predictedWords: 2, stake: 10 },
				{ bettorId: 'p4', targetPlayerId: 'p3', predictedWords: 1, stake: 10 }
			],
			new Map([['p3', 2]])
		);

		// p2 gets: stake back 10 + full pool 20 + bonus 10 = 40
		assert.equal(settlement.adjustments.get('p2'), 40);
		assert.equal(settlement.adjustments.get('p3'), undefined);
	});

	it('only eligible bets (actual >= predicted) can win; closest among them wins', () => {
		// actual 3: only p1 (predicted 2) eligible. p1 wins. No other bettors on p4, so losing pool = 0.
		const settlement = settlePredictionBets(
			[
				{ bettorId: 'p1', targetPlayerId: 'p4', predictedWords: 2, stake: 9 },
				{ bettorId: 'p2', targetPlayerId: 'p4', predictedWords: 4, stake: 9 },
				{ bettorId: 'p3', targetPlayerId: 'p4', predictedWords: 10, stake: 9 }
			],
			new Map([['p4', 3]])
		);

		// p1 wins: stake back 9 + pool 0 (p2,p3 are losers so pool=18... wait, p2 and p3 are not winners so they're losers, pool=18) + bonus 9 = 9+18+9 = 36
		assert.equal(settlement.adjustments.get('p1'), 36);
		assert.equal(settlement.adjustments.get('p4'), undefined);
	});

	it('sole winner with no other bettors gets stake back + bonus', () => {
		const settlement = settlePredictionBets(
			[{ bettorId: 'p1', targetPlayerId: 'p2', predictedWords: 3, stake: 5 }],
			new Map([['p2', 4]])
		);
		// p1 wins (4 >= 3), no losing pool. Gets stake back 5 + bonus 5 = 10
		assert.equal(settlement.adjustments.get('p1'), 10);
	});
});

describe('letter auction settlement', () => {
	it('awards uncontested picks directly and splits tie winners', () => {
		const settlement = settleLetterAuction(
			[
				{ id: 'l1', letter: 'A' },
				{ id: 'l2', letter: 'B' }
			],
			new Map([
				['p1', 'l1'],
				['p2', 'l2'],
				['p3', 'l2']
			]),
			[
				{ playerId: 'p2', letterId: 'l2', stake: 7 },
				{ playerId: 'p4', letterId: 'l2', stake: 7 }
			]
		);

		assert.equal(settlement.awards.get('p1'), 'A');
		assert.equal(settlement.awards.get('p2'), 'B');
		assert.equal(settlement.awards.get('p4'), 'B');
		assert.equal(settlement.chargedBids.get('p2'), 7);
		assert.equal(settlement.chargedBids.get('p4'), 7);
	});
});
