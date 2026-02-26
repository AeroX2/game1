# Realtime Svelte Boggle on Cloudflare

Realtime multiplayer Boggle built with SvelteKit and Cloudflare Durable Objects.

## Architecture

- `src/routes/+page.svelte`: game UI (lobby, board, timer, submit flow, scoreboard)
- `src/routes/api/rooms/**`: SvelteKit API routes that proxy room actions to Durable Objects
- `src/worker/rooms.ts`: Durable Object room state + WebSocket fanout
- `src/lib/game/boggle.ts`: board roll, adjacency path validation, and scoring
- `src/lib/dictionary/*`: starter dictionary for server-side word checks

## Local Development

```sh
npm install
npm run dev
```

This runs the standard SvelteKit dev server.

## Cloudflare Development

```sh
npm run cf:dev
```

This runs `wrangler dev` against the built Cloudflare worker with Durable Object bindings.

## Build and Deploy

```sh
npm run build
npm run cf:deploy
```

## Gameplay Notes

- Room creator gets a room code; other players join with that code.
- Press **Start Round** to roll a 4x4 board and begin a 2-minute timer.
- Words must be at least 3 letters, present in the dictionary, and traceable on the board.
- Score rules: 3-4 letters = 1, 5 = 2, 6 = 3, 7 = 5, 8+ = 11.

## Cloudflare Config

Durable Object binding and migration live in `wrangler.toml`:

- Binding name: `ROOMS`
- Class name: `BoggleRoom`
# game1
