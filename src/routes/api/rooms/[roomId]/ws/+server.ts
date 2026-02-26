import type { RequestHandler } from './$types';
import { roomStub } from '$lib/server/room-proxy';

export const GET: RequestHandler = async ({ params, request, platform, url }) => {
	const roomId = params.roomId.toUpperCase();
	const playerId = url.searchParams.get('playerId');
	if (!playerId) {
		return new Response('playerId is required', { status: 400 });
	}

	const stub = roomStub(platform, roomId);
	const upstreamUrl = new URL('https://room/ws');
	upstreamUrl.searchParams.set('playerId', playerId);

	return stub.fetch(upstreamUrl.toString(), {
		headers: {
			Upgrade: request.headers.get('Upgrade') ?? 'websocket',
			Connection: request.headers.get('Connection') ?? 'Upgrade',
			'Sec-WebSocket-Key': request.headers.get('Sec-WebSocket-Key') ?? '',
			'Sec-WebSocket-Version': request.headers.get('Sec-WebSocket-Version') ?? '13'
		}
	});
};
