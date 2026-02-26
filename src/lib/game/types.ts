export type PlayerSnapshot = {
	id: string;
	name: string;
	score: number;
	words: string[];
	extraLetter: string | null;
	roundWordCount: number;
	roundBoardPoints: number;
	roundPredictionPoints: number;
};

export type GamePhase =
	| 'lobby'
	| 'prediction'
	| 'letter_draft'
	| 'letter_auction'
	| 'active'
	| 'round_results'
	| 'finished';

export type PredictionBetSnapshot = {
	bettorId: string;
	targetPlayerId: string;
	predictedWords: number;
	stake: number;
};

export type DraftLetterSnapshot = {
	id: string;
	letter: string;
};

export type AuctionBidSnapshot = {
	playerId: string;
	letterId: string;
	stake: number;
};

export type RoomSnapshot = {
	roomId: string;
	board: string[];
	status: 'lobby' | 'active' | 'finished';
	phase: GamePhase;
	totalRounds: number;
	currentRound: number;
	startedAt: number | null;
	endsAt: number | null;
	players: PlayerSnapshot[];
	draftLetters: DraftLetterSnapshot[];
	contestedLetterIds: string[];
	currentAuctionLetterId: string | null;
	predictionBets: PredictionBetSnapshot[];
	predictionSkips: string[];
	auctionBids: AuctionBidSnapshot[];
	roundReadyPlayerIds: string[];
};

export type RoomEvent =
	| {
			type: 'state';
			state: RoomSnapshot;
	  }
	| {
			type: 'error';
			message: string;
	  };

export type SubmitResult = {
	ok: boolean;
	message: string;
	scoreDelta?: number;
	word?: string;
	state?: RoomSnapshot;
};
