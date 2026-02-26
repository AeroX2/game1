import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { settleLetterAuction, settlePredictionBets } from './economy';

describe('prediction settlement', () => {
	it('pays winners and target from losing pool', () => {
		const settlement = settlePredictionBets(
			[
				{ bettorId: 'p1', targetPlayerId: 'p3', predictedWords: 5, stake: 10 },
				{ bettorId: 'p2', targetPlayerId: 'p3', predictedWords: 2, stake: 10 },
				{ bettorId: 'p4', targetPlayerId: 'p3', predictedWords: 1, stake: 10 }
			],
			new Map([['p3', 2]])
		);

		assert.equal(settlement.adjustments.get('p2'), 14);
		assert.equal(settlement.adjustments.get('p3'), 6);
	});

	it('splits winner payout when closest bet ties', () => {
		const settlement = settlePredictionBets(
			[
				{ bettorId: 'p1', targetPlayerId: 'p4', predictedWords: 2, stake: 9 },
				{ bettorId: 'p2', targetPlayerId: 'p4', predictedWords: 4, stake: 9 },
				{ bettorId: 'p3', targetPlayerId: 'p4', predictedWords: 10, stake: 9 }
			],
			new Map([['p4', 3]])
		);

		assert.equal(settlement.adjustments.get('p1'), 3);
		assert.equal(settlement.adjustments.get('p2'), 3);
		assert.equal(settlement.adjustments.get('p4'), 3);
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
