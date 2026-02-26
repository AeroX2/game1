import { readFileSync, writeFileSync } from 'node:fs';

const workerPath = '.svelte-kit/cloudflare/_worker.js';
const exportLine = "export { BoggleRoom } from '../../src/worker/rooms.ts';";

const current = readFileSync(workerPath, 'utf8');

if (!current.includes(exportLine)) {
	writeFileSync(workerPath, `${current.trimEnd()}\n${exportLine}\n`);
}
