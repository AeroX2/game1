export type BoardCell = string;
export type Board = BoardCell[];

export type ValidationResult = {
	valid: boolean;
	reason?: string;
	usedExtraLetter?: boolean;
};

export const BOARD_SIZE = 5;

const LETTER_BAG = [
	...Array(13).fill('E'),
	...Array(9).fill('A'),
	...Array(9).fill('I'),
	...Array(8).fill('O'),
	...Array(6).fill('N'),
	...Array(6).fill('R'),
	...Array(6).fill('T'),
	...Array(4).fill('L'),
	...Array(4).fill('S'),
	...Array(4).fill('U'),
	...Array(3).fill('D'),
	...Array(3).fill('G'),
	...Array(3).fill('M'),
	...Array(2).fill('B'),
	...Array(2).fill('C'),
	...Array(2).fill('F'),
	...Array(2).fill('H'),
	...Array(2).fill('P'),
	...Array(2).fill('V'),
	...Array(2).fill('W'),
	...Array(2).fill('Y'),
	'K',
	'J',
	'X',
	'Q',
	'Z'
] as const;

const NEIGHBOR_OFFSETS = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, -1],
	[1, 0],
	[1, 1]
] as const;

export function scoreWord(word: string): number {
	const length = word.length;

	if (length < 3) return 0;
	if (length <= 4) return 1;
	if (length === 5) return 2;
	if (length === 6) return 3;
	if (length === 7) return 5;
	return 11;
}

export function normalizeWord(word: string): string {
	return word.trim().toUpperCase();
}

export function rollBoard(random = Math.random): Board {
	const board: Board = [];
	const length = BOARD_SIZE * BOARD_SIZE;
	for (let i = 0; i < length; i += 1) {
		board.push(drawLetter(random));
	}
	return board;
}

export function rollSmartBoard(dictionaryWords: readonly string[], random = Math.random): Board {
	const maxAttempts = 40;
	const minViableWords = 20;
	let bestBoard = rollBoard(random);
	let bestScore = -1;

	for (let i = 0; i < maxAttempts; i += 1) {
		const candidate = rollBoard(random);
		const score = estimateBoardViability(candidate, dictionaryWords, random);
		if (score > bestScore) {
			bestBoard = candidate;
			bestScore = score;
		}
		if (score >= minViableWords) {
			return candidate;
		}
	}

	return bestBoard;
}

export function validateWordOnBoard(
	board: Board,
	word: string,
	extraLetter: string | null = null
): ValidationResult {
	const normalized = normalizeWord(word);
	const normalizedExtra = normalizeExtraLetter(extraLetter);

	if (normalized.length < 3) {
		return { valid: false, reason: 'Words must be at least 3 letters.' };
	}

	const tokens = tokenizeForBoard(normalized);
	if (tokens.length === 0) {
		return { valid: false, reason: 'Invalid word.' };
	}

	const size = boardSize(board);
	if (size === 0) {
		return { valid: false, reason: 'Board is invalid.' };
	}

	for (let i = 0; i < board.length; i += 1) {
		const visited = new Set<number>();
		if (search(board, tokens, i, 0, visited, normalizedExtra, false)) {
			const usedExtraLetter = board[i] !== tokens[0] && normalizedExtra === tokens[0];
			return { valid: true, usedExtraLetter };
		}
	}

	return { valid: false, reason: 'Word cannot be formed on this board.' };
}

function search(
	board: Board,
	tokens: string[],
	index: number,
	tokenIndex: number,
	visited: Set<number>,
	extraLetter: string | null,
	usedExtraLetter: boolean
): boolean {
	if (visited.has(index)) return false;
	const needed = tokens[tokenIndex];
	const cell = board[index];
	let nextUsedExtra = usedExtraLetter;

	if (cell !== needed) {
		if (!extraLetter || usedExtraLetter || needed !== extraLetter) {
			return false;
		}
		nextUsedExtra = true;
	}

	if (tokenIndex === tokens.length - 1) {
		return true;
	}

	visited.add(index);
	const size = boardSize(board);
	const row = Math.floor(index / size);
	const col = index % size;

	for (const [dr, dc] of NEIGHBOR_OFFSETS) {
		const nextRow = row + dr;
		const nextCol = col + dc;
		if (nextRow < 0 || nextRow > size - 1 || nextCol < 0 || nextCol > size - 1) {
			continue;
		}

		const nextIndex = nextRow * size + nextCol;
		if (search(board, tokens, nextIndex, tokenIndex + 1, visited, extraLetter, nextUsedExtra)) {
			visited.delete(index);
			return true;
		}
	}

	visited.delete(index);
	return false;
}

function tokenizeForBoard(word: string): string[] {
	const tokens: string[] = [];

	for (let i = 0; i < word.length; i += 1) {
		const char = word[i];
		if (char === 'Q' && word[i + 1] === 'U') {
			tokens.push('Q');
			i += 1;
			continue;
		}

		if (char < 'A' || char > 'Z') {
			return [];
		}

		tokens.push(char);
	}

	return tokens;
}

function drawLetter(random: () => number): string {
	const idx = Math.floor(random() * LETTER_BAG.length);
	return LETTER_BAG[idx];
}

function boardSize(board: Board): number {
	const size = Math.sqrt(board.length);
	if (!Number.isInteger(size)) {
		return 0;
	}
	return size;
}

function normalizeExtraLetter(letter: string | null): string | null {
	if (!letter) return null;
	const normalized = normalizeWord(letter);
	if (normalized.length !== 1) return null;
	if (normalized < 'A' || normalized > 'Z') return null;
	return normalized;
}

function estimateBoardViability(board: Board, dictionaryWords: readonly string[], random: () => number): number {
	if (dictionaryWords.length === 0) return 0;
	const sampleSize = Math.min(900, dictionaryWords.length);
	let hits = 0;
	const start = Math.floor(random() * dictionaryWords.length);
	const step = Math.max(1, Math.floor(dictionaryWords.length / sampleSize));

	for (let i = 0; i < sampleSize; i += 1) {
		const index = (start + i * step) % dictionaryWords.length;
		const word = dictionaryWords[index];
		if (word.length > 9) continue;
		if (validateWordOnBoard(board, word).valid) {
			hits += 1;
		}
	}

	return hits;
}
