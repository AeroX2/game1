export type BoardCell = string;
export type Board = BoardCell[];

export type ValidationResult = {
	valid: boolean;
	reason?: string;
	usedExtraLetter?: boolean;
	/** Board cell indices in word order; -1 means extra letter was used at that position */
	path?: number[];
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

	const EXTRA_LETTER_INDEX = -1;

	for (let i = 0; i < board.length; i += 1) {
		const visited = new Set<number>();
		const path: number[] = [];
		const found = searchWithPath(
			board,
			tokens,
			i,
			0,
			visited,
			normalizedExtra,
			false,
			path,
			EXTRA_LETTER_INDEX
		);
		if (found) {
			const usedExtraLetter = board[i] !== tokens[0] && normalizedExtra === tokens[0];
			// Only attach path if it's connected (Boggle: each step must be to a neighbor)
			const validPath = isPathConnected(board, path) ? path : undefined;
			return { valid: true, usedExtraLetter, path: validPath };
		}
	}

	return { valid: false, reason: 'Word cannot be formed on this board.' };
}

function isPathConnected(board: Board, path: number[]): boolean {
	const size = boardSize(board);
	const extraLetterIndex = -1;
	let prev: number | null = null;
	for (let i = 0; i < path.length; i += 1) {
		const idx = path[i];
		if (idx === extraLetterIndex) continue;
		if (prev !== null) {
			const hadExtraBetween = i >= 2 && path[i - 1] === extraLetterIndex;
			const connected = hadExtraBetween
				? shareNeighbor(size, prev, idx)
				: areAdjacent(size, prev, idx);
			if (!connected) return false;
		}
		prev = idx;
	}
	return true;
}

function areAdjacent(size: number, a: number, b: number): boolean {
	const rowA = Math.floor(a / size);
	const colA = a % size;
	const rowB = Math.floor(b / size);
	const colB = b % size;
	const dr = Math.abs(rowA - rowB);
	const dc = Math.abs(colA - colB);
	return dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0);
}

function shareNeighbor(size: number, a: number, b: number): boolean {
	for (const [dr, dc] of NEIGHBOR_OFFSETS) {
		const row = Math.floor(a / size) + dr;
		const col = (a % size) + dc;
		if (row < 0 || row > size - 1 || col < 0 || col > size - 1) continue;
		const mid = row * size + col;
		if (areAdjacent(size, mid, b)) return true;
	}
	return false;
}

function searchWithPath(
	board: Board,
	tokens: string[],
	index: number,
	tokenIndex: number,
	visited: Set<number>,
	extraLetter: string | null,
	usedExtraLetter: boolean,
	path: number[],
	extraLetterIndex: number
): boolean {
	if (!(index === -1 || index === extraLetterIndex) && visited.has(index)) return false;
	const needed = tokens[tokenIndex];
	const cell = index >= 0 && index < board.length ? board[index] : '';
	let nextUsedExtra = usedExtraLetter;
	const isExtraHere = cell !== needed && extraLetter && !usedExtraLetter && needed === extraLetter;
	if (cell !== needed && !isExtraHere) {
		return false;
	}
	if (isExtraHere) nextUsedExtra = true;

	path.push(isExtraHere ? extraLetterIndex : index);
	if (tokenIndex === tokens.length - 1) {
		return true;
	}

	if (!isExtraHere) visited.add(index);
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
		if (
			searchWithPath(
				board,
				tokens,
				nextIndex,
				tokenIndex + 1,
				visited,
				extraLetter,
				nextUsedExtra,
				path,
				extraLetterIndex
			)
		) {
			if (!isExtraHere) visited.delete(index);
			return true;
		}
	}

	path.pop();
	if (!isExtraHere) visited.delete(index);
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
