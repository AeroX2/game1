import { getDictionaryWords, isDictionaryWord } from '$lib/dictionary';
import { normalizeWord, rollSmartBoard, scoreWord, validateWordOnBoard } from '$lib/game/boggle';
import { settlePredictionBets } from '$lib/game/economy';
import type {
	AuctionBidSnapshot,
	DraftLetterSnapshot,
	GamePhase,
	PredictionBetSnapshot,
	RoomEvent,
	RoomSnapshot,
	SubmitResult
} from '$lib/game/types';
import { getString, readJsonObject } from '$lib/shared/json';

type PlayerState = {
	id: string;
	name: string;
	score: number;
	words: Set<string>;
	extraLetter: string | null;
	roundWordCount: number;
	roundBoardPoints: number;
	roundPredictionPoints: number;
};

type PredictionBet = {
	bettorId: string;
	targetPlayerId: string;
	predictedWords: number;
	stake: number;
};

type AuctionBid = {
	playerId: string;
	letterId: string;
	stake: number;
};

type PersistedPlayer = {
	id: string;
	name: string;
	score: number;
	words: string[];
	extraLetter: string | null;
	roundWordCount: number;
	roundBoardPoints: number;
	roundPredictionPoints: number;
};

type PersistedState = {
	roomId: string;
	board: string[];
	phase: GamePhase;
	status: 'lobby' | 'active' | 'finished';
	totalRounds: number;
	currentRound: number;
	startedAt: number | null;
	endsAt: number | null;
	players: PersistedPlayer[];
	draftLetters: DraftLetterSnapshot[];
	contestedLetterIds: string[];
	currentAuctionLetterId: string | null;
	predictionBets: PredictionBet[];
	predictionSkips: string[];
	draftSelections: Array<{ playerId: string; letterId: string }>;
	auctionBids: AuctionBid[];
	roundReadyPlayerIds: string[];
	marketLetterPool: string[];
};

interface DurableObjectStorageLike {
	get(key: string): Promise<unknown>;
	put(key: string, value: PersistedState): Promise<void>;
	setAlarm(time: number): Promise<void>;
}

interface DurableObjectStateLike {
	storage: DurableObjectStorageLike;
	blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

interface DurableObjectSocket extends WebSocket {
	accept(): void;
}

type WsMessage = {
	type?: string;
	word?: string;
};

type WebSocketPairCtor = new () => [WebSocket, DurableObjectSocket];
declare const WebSocketPair: WebSocketPairCtor;

type WebSocketUpgradeInit = ResponseInit & {
	webSocket: WebSocket;
};

const ROUND_MS = 120_000;
const PHASE_TIMER_MS = 30_000;
const DEFAULT_TOTAL_ROUNDS = 3;
const MAX_TOTAL_ROUNDS = 12;
const STARTING_POINTS = 10;

export class BoggleRoom {
	private readonly state: DurableObjectStateLike;
	private readonly roomId: string;
	private players = new Map<string, PlayerState>();
	private sockets = new Map<DurableObjectSocket, string>();
	private board: string[] = [];
	private phase: GamePhase = 'lobby';
	private status: 'lobby' | 'active' | 'finished' = 'lobby';
	private totalRounds = DEFAULT_TOTAL_ROUNDS;
	private currentRound = 0;
	private startedAt: number | null = null;
	private endsAt: number | null = null;
	private draftLetters: DraftLetterSnapshot[] = [];
	private contestedLetterIds: string[] = [];
	private currentAuctionLetterId: string | null = null;
	private predictionBets = new Map<string, PredictionBet>();
	private predictionSkips = new Set<string>();
	private draftSelections = new Map<string, string>();
	private auctionBids = new Map<string, AuctionBid>();
	private roundReadyPlayerIds = new Set<string>();
	private marketLetterPool: string[] = [];

	constructor(state: DurableObjectStateLike, env: { ROOM_ID?: string } = {}) {
		this.state = state;
		this.roomId = env.ROOM_ID ?? 'unknown';
		this.state.blockConcurrencyWhile(async () => {
			await this.restore();
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path === '/ws') {
			return this.handleWs(url, request);
		}

		if (path === '/create' && request.method === 'POST') {
			return this.handleCreate(request);
		}

		if (path === '/join' && request.method === 'POST') {
			return this.handleJoin(request);
		}

		if (path === '/start' && request.method === 'POST') {
			return this.handleStart(request);
		}

		if (path === '/submit' && request.method === 'POST') {
			return this.handleSubmit(request);
		}

		if (path === '/configure-rounds' && request.method === 'POST') {
			return this.handleConfigureRounds(request);
		}

		if (path === '/prediction-bet' && request.method === 'POST') {
			return this.handlePredictionBet(request);
		}

		if (path === '/draft-pick' && request.method === 'POST') {
			return this.handleDraftPick(request);
		}

		if (path === '/auction-bid' && request.method === 'POST') {
			return this.handleAuctionBid(request);
		}

		if (path === '/state' && request.method === 'GET') {
			return this.json(this.snapshot());
		}

		return this.json({ error: 'Not found' }, 404);
	}

	async alarm(): Promise<void> {
		if (this.endsAt === null || Date.now() < this.endsAt) return;
		if (this.phase === 'letter_draft') {
			await this.resolveDraftPhase();
			await this.persist();
			this.broadcastState();
			return;
		}
		if (this.phase === 'letter_auction') {
			await this.resolveAuctionPhase();
			await this.persist();
			this.broadcastState();
			return;
		}
		if (this.phase === 'prediction') {
			await this.startActiveRound();
			await this.persist();
			this.broadcastState();
			return;
		}
		if (this.phase === 'active') {
			await this.finishActiveRound();
		}
	}

	private async restore(): Promise<void> {
		const saved = await this.state.storage.get('room-state');
		if (!isPersistedState(saved)) return;

		this.board = saved.board;
		this.phase = saved.phase;
		this.status = saved.status;
		this.totalRounds = saved.totalRounds;
		this.currentRound = saved.currentRound;
		this.startedAt = saved.startedAt;
		this.endsAt = saved.endsAt;
		this.draftLetters = saved.draftLetters;
		this.contestedLetterIds = saved.contestedLetterIds;
		this.currentAuctionLetterId = saved.currentAuctionLetterId;
		this.predictionBets = new Map(saved.predictionBets.map((entry) => [entry.bettorId, entry]));
		this.predictionSkips = new Set(saved.predictionSkips);
		this.draftSelections = new Map(saved.draftSelections.map((entry) => [entry.playerId, entry.letterId]));
		this.auctionBids = new Map(saved.auctionBids.map((entry) => [entry.playerId, entry]));
		this.roundReadyPlayerIds = new Set(saved.roundReadyPlayerIds);
		this.marketLetterPool = saved.marketLetterPool;
		this.players = new Map(
			saved.players.map((player) => [
				player.id,
				{
					...player,
					words: new Set(player.words)
				}
			])
		);
		this.updateStatusFromPhase();
	}

	private async persist(): Promise<void> {
		const payload: PersistedState = {
			roomId: this.roomId,
			board: this.board,
			phase: this.phase,
			status: this.status,
			totalRounds: this.totalRounds,
			currentRound: this.currentRound,
			startedAt: this.startedAt,
			endsAt: this.endsAt,
			players: Array.from(this.players.values()).map((player) => ({
				id: player.id,
				name: player.name,
				score: player.score,
				words: [...player.words],
				extraLetter: player.extraLetter,
				roundWordCount: player.roundWordCount,
				roundBoardPoints: player.roundBoardPoints,
				roundPredictionPoints: player.roundPredictionPoints
			})),
			draftLetters: this.draftLetters,
			contestedLetterIds: this.contestedLetterIds,
			currentAuctionLetterId: this.currentAuctionLetterId,
			predictionBets: Array.from(this.predictionBets.values()),
			predictionSkips: Array.from(this.predictionSkips.values()),
			draftSelections: Array.from(this.draftSelections.entries()).map(([playerId, letterId]) => ({
				playerId,
				letterId
			})),
			auctionBids: Array.from(this.auctionBids.values()),
			roundReadyPlayerIds: Array.from(this.roundReadyPlayerIds.values()),
			marketLetterPool: this.marketLetterPool
		};

		await this.state.storage.put('room-state', payload);
	}

	private async handleCreate(request: Request): Promise<Response> {
		const body = await readJsonObject(request);
		const player = this.addPlayer(getString(body, 'name') ?? 'Player');
		await this.persist();
		this.broadcastState();
		return this.json({ playerId: player.id, state: this.snapshot() });
	}

	private async handleJoin(request: Request): Promise<Response> {
		const body = await readJsonObject(request);
		const player = this.addPlayer(getString(body, 'name') ?? 'Player');
		await this.persist();
		this.broadcastState();
		return this.json({ playerId: player.id, state: this.snapshot() });
	}

	private async handleStart(request: Request): Promise<Response> {
		const body = await readJsonObject(request);
		const roundInput = getNumber(body, 'totalRounds');
		if (this.phase === 'lobby') {
			if (roundInput !== undefined) {
				if (roundInput < 1 || roundInput > MAX_TOTAL_ROUNDS) {
					return this.json({ error: `totalRounds must be between 1 and ${MAX_TOTAL_ROUNDS}.` }, 400);
				}
				this.totalRounds = Math.floor(roundInput);
			}
			this.currentRound = 1;
			this.prepareRound();
			this.phase = 'letter_draft';
			this.beginPhaseTimer(PHASE_TIMER_MS);
			this.updateStatusFromPhase();
			await this.persist();
			this.broadcastState();
			return this.json({ ok: true, state: this.snapshot() });
		}

		if (this.phase === 'letter_draft') {
			await this.resolveDraftPhase();
			await this.persist();
			this.broadcastState();
			return this.json({ ok: true, state: this.snapshot() });
		}

		if (this.phase === 'letter_auction') {
			await this.resolveAuctionPhase();
			await this.persist();
			this.broadcastState();
			return this.json({ ok: true, state: this.snapshot() });
		}

		if (this.phase === 'prediction') {
			await this.startActiveRound();
			await this.persist();
			this.broadcastState();
			return this.json({ ok: true, state: this.snapshot() });
		}

		if (this.phase === 'round_results') {
			const playerId = getString(body, 'playerId') ?? '';
			if (!this.players.has(playerId)) {
				return this.json({ error: 'Invalid player.' }, 400);
			}
			this.roundReadyPlayerIds.add(playerId);
			if (this.roundReadyPlayerIds.size < this.players.size) {
				await this.persist();
				this.broadcastState();
				return this.json({ ok: true, state: this.snapshot() });
			}
			if (this.currentRound < this.totalRounds) {
				this.currentRound += 1;
				this.prepareRound();
				this.phase = 'letter_draft';
				this.beginPhaseTimer(PHASE_TIMER_MS);
			} else {
				this.phase = 'finished';
			}
			this.updateStatusFromPhase();
			await this.persist();
			this.broadcastState();
			return this.json({ ok: true, state: this.snapshot() });
		}

		return this.json({ error: 'Cannot start from current phase.' }, 400);
	}

	private async handleSubmit(request: Request): Promise<Response> {
		const body = await readJsonObject(request);
		const result = await this.submit(getString(body, 'playerId') ?? '', getString(body, 'word') ?? '');
		return this.json(result, result.ok ? 200 : 400);
	}

	private async submit(playerId: string, rawWord: string): Promise<SubmitResult> {
		const player = this.players.get(playerId);
		if (!player) {
			return { ok: false, message: 'Player not found.' };
		}

		if (this.phase !== 'active' || this.endsAt === null || Date.now() > this.endsAt) {
			if (this.phase === 'active') {
				await this.finishActiveRound();
			}
			return { ok: false, message: 'Round is not active.', state: this.snapshot() };
		}

		const word = normalizeWord(rawWord);
		const boardValidation = validateWordOnBoard(this.board, word, player.extraLetter);
		if (!boardValidation.valid) {
			return { ok: false, message: boardValidation.reason ?? 'Invalid board word.' };
		}

		if (!isDictionaryWord(word)) {
			return { ok: false, message: 'Word not found in dictionary.' };
		}

		if (player.words.has(word)) {
			return { ok: false, message: 'Word already submitted.' };
		}

		const scoreDelta = scoreWord(word);
		if (scoreDelta < 1) {
			return { ok: false, message: 'Word is too short to score.' };
		}

		player.words.add(word);
		player.score += scoreDelta;
		player.roundWordCount += 1;
		player.roundBoardPoints += scoreDelta;

		await this.persist();
		this.broadcastState();

		return {
			ok: true,
			message: `Accepted ${word} (+${scoreDelta})`,
			scoreDelta,
			word,
			state: this.snapshot()
		};
	}

	private async handleWs(url: URL, request: Request): Promise<Response> {
		const upgrade = request.headers.get('Upgrade');
		if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
			return this.json({ error: 'Expected websocket upgrade.' }, 426);
		}

		const playerId = url.searchParams.get('playerId');
		if (!playerId || !this.players.has(playerId)) {
			return this.json({ error: 'Invalid player.' }, 400);
		}

		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];

		server.accept();
		this.sockets.set(server, playerId);
		server.addEventListener('close', () => {
			this.sockets.delete(server);
		});
		server.addEventListener('error', () => {
			this.sockets.delete(server);
		});
		server.addEventListener('message', async (event: MessageEvent) => {
			try {
				const payload = parseWsMessage(event.data);
				if (payload.type === 'submit' && payload.word) {
					const result = await this.submit(playerId, payload.word);
					if (!result.ok) {
						this.send(server, { type: 'error', message: result.message });
					}
				}
				if (payload.type === 'ping') {
					this.send(server, { type: 'state', state: this.snapshot() });
				}
			} catch {
				this.send(server, { type: 'error', message: 'Malformed websocket payload.' });
			}
		});

		this.send(server, { type: 'state', state: this.snapshot() });

		const responseInit: WebSocketUpgradeInit = {
			status: 101,
			webSocket: client
		};

		return new Response(null, responseInit);
	}

	private addPlayer(name: string): PlayerState {
		const id = crypto.randomUUID();
		const player: PlayerState = {
			id,
			name: name.trim().slice(0, 24) || 'Player',
			score: STARTING_POINTS,
			words: new Set(),
			extraLetter: null,
			roundWordCount: 0,
			roundBoardPoints: 0,
			roundPredictionPoints: 0
		};
		this.players.set(id, player);
		return player;
	}

	private snapshot(): RoomSnapshot {
		return {
			roomId: this.roomId,
			board: this.board,
			phase: this.phase,
			status: this.status,
			totalRounds: this.totalRounds,
			currentRound: this.currentRound,
			startedAt: this.startedAt,
			endsAt: this.endsAt,
			draftLetters: this.draftLetters,
			contestedLetterIds: this.contestedLetterIds,
			currentAuctionLetterId: this.currentAuctionLetterId,
			predictionBets: Array.from(this.predictionBets.values())
				.map((entry) => ({
					bettorId: entry.bettorId,
					targetPlayerId: entry.targetPlayerId,
					predictedWords: entry.predictedWords,
					stake: entry.stake
				}))
				.sort((a, b) => a.bettorId.localeCompare(b.bettorId)),
			predictionSkips: Array.from(this.predictionSkips.values()).sort((a, b) => a.localeCompare(b)),
			auctionBids: Array.from(this.auctionBids.values())
				.map((entry) => ({
					playerId: entry.playerId,
					letterId: entry.letterId,
					stake: entry.stake
				}))
				.sort((a, b) => a.playerId.localeCompare(b.playerId)),
			roundReadyPlayerIds: Array.from(this.roundReadyPlayerIds.values()).sort((a, b) =>
				a.localeCompare(b)
			),
			players: Array.from(this.players.values())
				.map((player) => ({
					id: player.id,
					name: player.name,
					score: player.score,
					words: [...player.words].sort(),
					extraLetter: player.extraLetter,
					roundWordCount: player.roundWordCount,
					roundBoardPoints: player.roundBoardPoints,
					roundPredictionPoints: player.roundPredictionPoints
				}))
				.sort((a, b) => b.score - a.score)
		};
	}

	private async handleConfigureRounds(request: Request): Promise<Response> {
		if (this.phase !== 'lobby') {
			return this.json({ error: 'Rounds can only be configured in lobby.' }, 400);
		}
		const body = await readJsonObject(request);
		const totalRounds = getNumber(body, 'totalRounds');
		if (totalRounds === undefined) {
			return this.json({ error: 'totalRounds is required.' }, 400);
		}
		if (totalRounds < 1 || totalRounds > MAX_TOTAL_ROUNDS) {
			return this.json({ error: `totalRounds must be between 1 and ${MAX_TOTAL_ROUNDS}.` }, 400);
		}
		this.totalRounds = Math.floor(totalRounds);
		await this.persist();
		this.broadcastState();
		return this.json({ ok: true, state: this.snapshot() });
	}

	private async handlePredictionBet(request: Request): Promise<Response> {
		if (this.phase !== 'prediction') {
			return this.json({ error: 'Prediction phase is not active.' }, 400);
		}
		const body = await readJsonObject(request);
		const bettorId = getString(body, 'bettorId') ?? '';
		const skip = getBoolean(body, 'skip') ?? false;
		const targetPlayerId = getString(body, 'targetPlayerId') ?? '';
		const predictedWords = getNumber(body, 'predictedWords');
		const stake = getNumber(body, 'stake');

		const bettor = this.players.get(bettorId);
		if (!bettor) return this.json({ error: 'Invalid bettor.' }, 400);
		if (this.predictionSkips.has(bettorId) || this.predictionBets.has(bettorId)) {
			return this.json({ error: 'Prediction already submitted.' }, 400);
		}
		if (skip) {
			this.predictionSkips.add(bettorId);
			if (this.allPlayersResolvedPrediction()) {
				await this.startActiveRound();
			}
			await this.persist();
			this.broadcastState();
			return this.json({ ok: true, state: this.snapshot() });
		}

		if (!this.players.has(targetPlayerId)) return this.json({ error: 'Invalid target player.' }, 400);
		if (targetPlayerId === bettorId) return this.json({ error: 'You must bet on another player.' }, 400);
		if (predictedWords === undefined || predictedWords < 0) {
			return this.json({ error: 'predictedWords must be >= 0.' }, 400);
		}
		if (stake === undefined || stake <= 0) {
			return this.json({ error: 'stake must be > 0.' }, 400);
		}
		const roundedStake = Math.floor(stake);
		if (bettor.score < roundedStake) {
			return this.json({ error: 'Not enough points to place that bet.' }, 400);
		}

		bettor.score -= roundedStake;
		this.predictionBets.set(bettorId, {
			bettorId,
			targetPlayerId,
			predictedWords: Math.floor(predictedWords),
			stake: roundedStake
		});
		if (this.allPlayersResolvedPrediction()) {
			await this.startActiveRound();
		}

		await this.persist();
		this.broadcastState();
		return this.json({ ok: true, state: this.snapshot() });
	}

	private async handleDraftPick(request: Request): Promise<Response> {
		if (this.phase !== 'letter_draft') {
			return this.json({ error: 'Letter draft phase is not active.' }, 400);
		}
		const body = await readJsonObject(request);
		const playerId = getString(body, 'playerId') ?? '';
		const letterId = getString(body, 'letterId') ?? '';
		const player = this.players.get(playerId);
		if (!player) return this.json({ error: 'Invalid player.' }, 400);
		if (player.extraLetter) {
			return this.json({ error: 'You already have an extra letter this round.' }, 400);
		}
		if (this.draftSelections.has(playerId)) return this.json({ error: 'Draft pick already submitted.' }, 400);
		if (!this.draftLetters.some((entry) => entry.id === letterId)) {
			return this.json({ error: 'Invalid letter selection.' }, 400);
		}

		this.draftSelections.set(playerId, letterId);
		if (this.allPlayersPickedDraftLetter()) {
			await this.resolveDraftPhase();
		}

		await this.persist();
		this.broadcastState();
		return this.json({ ok: true, state: this.snapshot() });
	}

	private async handleAuctionBid(request: Request): Promise<Response> {
		if (this.phase !== 'letter_auction') {
			return this.json({ error: 'Letter auction phase is not active.' }, 400);
		}
		const body = await readJsonObject(request);
		const playerId = getString(body, 'playerId') ?? '';
		const stake = Math.floor(getNumber(body, 'stake') ?? 0);
		const player = this.players.get(playerId);
		if (!player) return this.json({ error: 'Invalid player.' }, 400);
		if (player.extraLetter) {
			return this.json({ error: 'Players with an extra letter cannot bid.' }, 400);
		}
		if (this.auctionBids.has(playerId)) {
			return this.json({ error: 'Auction bid already submitted.' }, 400);
		}
		if (stake < 0) {
			return this.json({ error: 'stake must be >= 0.' }, 400);
		}
		if (stake > player.score) {
			return this.json({ error: 'Not enough points to place that bid.' }, 400);
		}
		const letterId = this.currentAuctionLetterId;
		if (!letterId) {
			return this.json({ error: 'No contested letter is currently being auctioned.' }, 400);
		}

		player.score -= stake;
		this.auctionBids.set(playerId, { playerId, letterId, stake });

		if (this.allEligibleAuctionPlayersBid()) {
			await this.resolveAuctionPhase();
		}

		await this.persist();
		this.broadcastState();
		return this.json({ ok: true, state: this.snapshot() });
	}

	private prepareRound(): void {
		this.board = [];
		this.startedAt = null;
		this.endsAt = null;
		this.predictionBets.clear();
		this.predictionSkips.clear();
		this.draftSelections.clear();
		this.auctionBids.clear();
		this.roundReadyPlayerIds.clear();
		this.contestedLetterIds = [];
		for (const player of this.players.values()) {
			player.words.clear();
			player.extraLetter = null;
			player.roundWordCount = 0;
			player.roundBoardPoints = 0;
			player.roundPredictionPoints = 0;
		}
		this.currentAuctionLetterId = null;
		this.marketLetterPool = generateUniqueLetters(this.players.size);
		this.draftLetters = this.generateDraftLetters(this.playersWithoutExtraLetterCount());
	}

	private generateDraftLetters(count: number): DraftLetterSnapshot[] {
		if (count <= 0) return [];
		const available = [...this.marketLetterPool];
		shuffleInPlace(available);
		const output: DraftLetterSnapshot[] = [];
		for (let i = 0; i < Math.min(count, available.length); i += 1) {
			output.push({
				id: `${this.currentRound}-${i}-${crypto.randomUUID().slice(0, 6)}`,
				letter: available[i]
			});
		}
		return output;
	}

	private async resolveDraftPhase(): Promise<void> {
		const eligiblePlayerIds = this.playersWithoutExtraLetterIds();
		for (const playerId of eligiblePlayerIds) {
			if (this.draftSelections.has(playerId)) continue;
			const randomLetterId = this.pickRandomDraftLetterId();
			if (randomLetterId) {
				this.draftSelections.set(playerId, randomLetterId);
			}
		}

		const selectorsByLetter = new Map<string, string[]>();
		for (const [playerId, letterId] of this.draftSelections.entries()) {
			const player = this.players.get(playerId);
			if (!player || player.extraLetter) continue;
			const list = selectorsByLetter.get(letterId) ?? [];
			list.push(playerId);
			selectorsByLetter.set(letterId, list);
		}

		this.contestedLetterIds = [];
		const lookup = new Map(this.draftLetters.map((entry) => [entry.id, entry.letter]));
		for (const [letterId, selectors] of selectorsByLetter.entries()) {
			if (selectors.length === 1) {
				const letter = lookup.get(letterId);
				if (!letter) continue;
				const player = this.players.get(selectors[0]);
				if (player) {
					this.assignExtraLetter(player.id, letter);
				}
				continue;
			}
			this.contestedLetterIds.push(letterId);
		}

		if (!this.contestedLetterIds.length || this.auctionEligiblePlayerIds().length === 0) {
			await this.continueMarketOrPrediction();
			return;
		}

		this.currentAuctionLetterId = this.contestedLetterIds[0] ?? null;
		this.auctionBids.clear();
		this.phase = 'letter_auction';
		this.beginPhaseTimer(PHASE_TIMER_MS);
		this.updateStatusFromPhase();
	}

	private async resolveAuctionPhase(): Promise<void> {
		const activeLetterId = this.currentAuctionLetterId;
		if (!activeLetterId) {
			await this.continueMarketOrPrediction();
			return;
		}

		const activeLetter = this.draftLetters.find((entry) => entry.id === activeLetterId);
		if (!activeLetter) {
			this.currentAuctionLetterId = null;
			await this.continueMarketOrPrediction();
			return;
		}

		const eligiblePlayerIds = this.auctionEligiblePlayerIds();
		for (const playerId of eligiblePlayerIds) {
			if (this.auctionBids.has(playerId)) continue;
			this.auctionBids.set(playerId, { playerId, letterId: activeLetterId, stake: 0 });
		}

		const letterBids = eligiblePlayerIds
			.map((playerId) => this.auctionBids.get(playerId))
			.filter((bid): bid is AuctionBid => Boolean(bid))
			.filter((bid) => bid.letterId === activeLetterId);

		let winnerId: string | null = null;
		if (letterBids.length > 0) {
			let bestBid = Number.NEGATIVE_INFINITY;
			for (const bid of letterBids) {
				if (bid.stake > bestBid) bestBid = bid.stake;
			}
			const leaders = letterBids.filter((bid) => bid.stake === bestBid);
			winnerId = leaders[Math.floor(Math.random() * leaders.length)]?.playerId ?? null;
		}

		if (winnerId) {
			this.assignExtraLetter(winnerId, activeLetter.letter);
		}

		this.contestedLetterIds = this.contestedLetterIds.filter((letterId) => letterId !== activeLetterId);
		this.currentAuctionLetterId = null;
		this.auctionBids.clear();

		if (this.contestedLetterIds.length > 0 && this.playersWithoutExtraLetterCount() > 0) {
			this.currentAuctionLetterId = this.contestedLetterIds[0] ?? null;
			this.phase = 'letter_auction';
			this.beginPhaseTimer(PHASE_TIMER_MS);
			this.updateStatusFromPhase();
			return;
		}

		await this.continueMarketOrPrediction();
	}

	private async enterPredictionPhase(): Promise<void> {
		this.ensureAllPlayersHaveExtraLetter();
		this.phase = 'prediction';
		this.beginPhaseTimer(PHASE_TIMER_MS);
		this.updateStatusFromPhase();
	}

	private async startActiveRound(): Promise<void> {
		this.board = rollSmartBoard(getDictionaryWords());
		this.startedAt = Date.now();
		this.endsAt = this.startedAt + ROUND_MS;
		this.phase = 'active';
		this.updateStatusFromPhase();
		await this.state.storage.setAlarm(this.endsAt);
	}

	private async finishActiveRound(): Promise<void> {
		if (this.phase !== 'active') return;
		this.startedAt = null;
		this.endsAt = null;
		this.applyPredictionPayouts();
		this.phase = 'round_results';
		this.updateStatusFromPhase();
		await this.persist();
		this.broadcastState();
	}

	private applyPredictionPayouts(): void {
		if (this.predictionBets.size === 0) {
			return;
		}
		const actualWordCounts = new Map<string, number>();
		for (const player of this.players.values()) {
			actualWordCounts.set(player.id, player.roundWordCount);
		}
		const settlement = settlePredictionBets(Array.from(this.predictionBets.values()), actualWordCounts);
		for (const [playerId, delta] of settlement.adjustments.entries()) {
			const player = this.players.get(playerId);
			if (!player) continue;
			player.score += delta;
			player.roundPredictionPoints += delta;
		}
	}

	private allPlayersPlacedPrediction(): boolean {
		return this.predictionBets.size === this.players.size;
	}

	private allPlayersSkippedPrediction(): boolean {
		return this.predictionSkips.size === this.players.size;
	}

	private allPlayersResolvedPrediction(): boolean {
		return this.predictionSkips.size + this.predictionBets.size >= this.players.size;
	}

	private allPlayersPickedDraftLetter(): boolean {
		const eligible = this.playersWithoutExtraLetterIds();
		if (eligible.length === 0) return true;
		return eligible.every((playerId) => this.draftSelections.has(playerId));
	}

	private ensureAllPlayersHaveExtraLetter(): void {
		for (const playerId of this.playersWithoutExtraLetterIds()) {
			const assigned = new Set(
				Array.from(this.players.values())
					.map((player) => player.extraLetter)
					.filter((letter): letter is string => Boolean(letter))
			);
			const fallbackLetter = this.marketLetterPool.pop() ?? generateUniqueLetters(1, assigned)[0] ?? 'A';
			this.assignExtraLetter(playerId, fallbackLetter);
		}
	}

	private allEligibleAuctionPlayersBid(): boolean {
		const eligible = this.auctionEligiblePlayerIds();
		if (eligible.length === 0) return true;
		return eligible.every((playerId) => this.auctionBids.has(playerId));
	}

	private auctionEligiblePlayerIds(): string[] {
		return Array.from(this.players.values())
			.filter((player) => !player.extraLetter)
			.map((player) => player.id);
	}

	private playersWithoutExtraLetterIds(): string[] {
		return Array.from(this.players.values())
			.filter((player) => !player.extraLetter)
			.map((player) => player.id);
	}

	private playersWithoutExtraLetterCount(): number {
		return this.playersWithoutExtraLetterIds().length;
	}

	private pickRandomDraftLetterId(): string | null {
		if (this.draftLetters.length === 0) return null;
		const idx = Math.floor(Math.random() * this.draftLetters.length);
		return this.draftLetters[idx]?.id ?? null;
	}

	private assignExtraLetter(playerId: string, letter: string): void {
		const player = this.players.get(playerId);
		if (!player || player.extraLetter) return;
		player.extraLetter = letter;
		const poolIndex = this.marketLetterPool.indexOf(letter);
		if (poolIndex >= 0) {
			this.marketLetterPool.splice(poolIndex, 1);
		}
	}

	private async continueMarketOrPrediction(): Promise<void> {
		if (this.playersWithoutExtraLetterCount() <= 0) {
			await this.enterPredictionPhase();
			return;
		}

		this.draftSelections.clear();
		this.auctionBids.clear();
		this.contestedLetterIds = [];
		this.currentAuctionLetterId = null;
		this.draftLetters = this.generateDraftLetters(this.playersWithoutExtraLetterCount());
		this.phase = 'letter_draft';
		this.beginPhaseTimer(PHASE_TIMER_MS);
		this.updateStatusFromPhase();
	}

	private updateStatusFromPhase(): void {
		if (this.phase === 'active') {
			this.status = 'active';
			return;
		}
		if (this.phase === 'finished') {
			this.status = 'finished';
			return;
		}
		this.status = 'lobby';
	}

	private beginPhaseTimer(durationMs: number): void {
		this.startedAt = Date.now();
		this.endsAt = this.startedAt + durationMs;
		void this.state.storage.setAlarm(this.endsAt);
	}

	private broadcastState(): void {
		const payload: RoomEvent = {
			type: 'state',
			state: this.snapshot()
		};

		for (const socket of this.sockets.keys()) {
			this.send(socket, payload);
		}
	}

	private send(socket: DurableObjectSocket, payload: RoomEvent): void {
		try {
			socket.send(JSON.stringify(payload));
		} catch {
			this.sockets.delete(socket);
		}
	}

	private json(payload: unknown, status = 200): Response {
		return new Response(JSON.stringify(payload), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	}
}

function parseWsMessage(data: unknown): WsMessage {
	if (typeof data !== 'string') {
		return {};
	}

	try {
		const parsed = JSON.parse(data);
		if (!isRecord(parsed)) {
			return {};
		}

		return {
			type: getString(parsed, 'type'),
			word: getString(parsed, 'word')
		};
	} catch {
		return {};
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isPersistedPlayer(value: unknown): value is PersistedPlayer {
	if (!isRecord(value)) return false;
	if (typeof value.id !== 'string') return false;
	if (typeof value.name !== 'string') return false;
	if (typeof value.score !== 'number') return false;
	if (value.extraLetter !== null && typeof value.extraLetter !== 'string') return false;
	if (typeof value.roundWordCount !== 'number') return false;
	if (typeof value.roundBoardPoints !== 'number') return false;
	if (typeof value.roundPredictionPoints !== 'number') return false;
	if (!Array.isArray(value.words)) return false;
	return value.words.every((word) => typeof word === 'string');
}

function isPersistedState(value: unknown): value is PersistedState {
	if (!isRecord(value)) return false;
	if (typeof value.roomId !== 'string') return false;
	if (!Array.isArray(value.board) || !value.board.every((cell) => typeof cell === 'string')) return false;
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
	if (value.status !== 'lobby' && value.status !== 'active' && value.status !== 'finished') return false;
	if (typeof value.totalRounds !== 'number') return false;
	if (typeof value.currentRound !== 'number') return false;
	if (value.startedAt !== null && typeof value.startedAt !== 'number') return false;
	if (value.endsAt !== null && typeof value.endsAt !== 'number') return false;
	if (!Array.isArray(value.players)) return false;
	if (!Array.isArray(value.draftLetters)) return false;
	if (
		!value.draftLetters.every((entry) => {
			if (!isRecord(entry)) return false;
			if (typeof entry.id !== 'string') return false;
			return typeof entry.letter === 'string';
		})
	) {
		return false;
	}
	if (!Array.isArray(value.contestedLetterIds)) return false;
	if (!value.contestedLetterIds.every((entry) => typeof entry === 'string')) return false;
	if (value.currentAuctionLetterId !== null && typeof value.currentAuctionLetterId !== 'string') {
		return false;
	}
	if (!Array.isArray(value.predictionBets)) return false;
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
	if (!Array.isArray(value.draftSelections)) return false;
	if (!Array.isArray(value.predictionSkips)) return false;
	if (!value.predictionSkips.every((entry) => typeof entry === 'string')) return false;
	if (
		!value.draftSelections.every((entry) => {
			if (!isRecord(entry)) return false;
			if (typeof entry.playerId !== 'string') return false;
			return typeof entry.letterId === 'string';
		})
	) {
		return false;
	}
	if (!Array.isArray(value.auctionBids)) return false;
	if (
		!value.auctionBids.every((entry) => {
			if (!isRecord(entry)) return false;
			if (typeof entry.playerId !== 'string') return false;
			if (typeof entry.letterId !== 'string') return false;
			return typeof entry.stake === 'number';
		})
	) {
		return false;
	}
	if (!Array.isArray(value.roundReadyPlayerIds)) return false;
	if (!value.roundReadyPlayerIds.every((entry) => typeof entry === 'string')) return false;
	if (!Array.isArray(value.marketLetterPool)) return false;
	if (!value.marketLetterPool.every((entry) => typeof entry === 'string')) return false;
	return value.players.every((player) => isPersistedPlayer(player));
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
	const value = record[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
	const value = record[key];
	return typeof value === 'boolean' ? value : undefined;
}

function shuffleInPlace<T>(items: T[]): void {
	for (let i = items.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = items[i];
		items[i] = items[j];
		items[j] = tmp;
	}
}

function generateUniqueLetters(count: number, disallowed = new Set<string>()): string[] {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((letter) => !disallowed.has(letter));
	shuffleInPlace(alphabet);
	if (count <= alphabet.length) {
		return alphabet.slice(0, count);
	}
	const output = [...alphabet];
	while (output.length < count) {
		const idx = Math.floor(Math.random() * alphabet.length);
		output.push(alphabet[idx] ?? 'A');
	}
	return output;
}
