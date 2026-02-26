import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rollSmartBoard, validateWordOnBoard } from './boggle';

describe('boggle board logic', () => {
	it('creates a smart 5x5 board', () => {
		const board = rollSmartBoard(['CAT', 'DOG', 'MOUSE', 'HOUSE']);
		assert.equal(board.length, 25);
		for (const cell of board) {
			assert.match(cell, /^[A-Z]$/);
		}
	});

	it('allows one extra-letter substitution', () => {
		const board = [
			'C',
			'A',
			'T',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X',
			'X'
		];

		assert.equal(validateWordOnBoard(board, 'CAR').valid, false);
		assert.equal(validateWordOnBoard(board, 'CAR', 'R').valid, true);
		assert.equal(validateWordOnBoard(Array(25).fill('A'), 'BBB', 'B').valid, false);
	});
});
