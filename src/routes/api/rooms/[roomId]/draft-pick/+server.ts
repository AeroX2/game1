import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyJson, roomStub } from '$lib/server/room-proxy';
import { getString, readJsonObject } from '$lib/shared/json';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const roomId = params.roomId.toUpperCase();
	const body = await readJsonObject(request);
	const playerId = getString(body, 'playerId');
	const letterId = getString(body, 'letterId');
	const stub = roomStub(platform, roomId);
	const upstream = await proxyJson(stub, '/draft-pick', 'POST', { playerId, letterId });
	const payload = await upstream.json();
	return json(payload, { status: upstream.status });
};
