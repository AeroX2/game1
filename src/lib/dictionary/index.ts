import rawWords from './words.txt?raw';

const WORDS = rawWords
	.split(/\r?\n/)
	.map((word) => word.trim().toUpperCase())
	.filter((word) => word.length >= 3);

const DICTIONARY = new Set(WORDS);

export function isDictionaryWord(word: string): boolean {
	return DICTIONARY.has(word);
}

export function getDictionaryWords(): readonly string[] {
	return WORDS;
}
