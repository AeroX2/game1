import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyJson, roomStub } from '$lib/server/room-proxy';
import { readJsonObject } from '$lib/shared/json';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const roomId = params.roomId.toUpperCase();
	const body = await readJsonObject(request);
	const totalRounds = typeof body.totalRounds === 'number' ? body.totalRounds : undefined;
	const stub = roomStub(platform, roomId);
	const upstream = await proxyJson(stub, '/configure-rounds', 'POST', { totalRounds });
	const payload = await upstream.json();
	return json(payload, { status: upstream.status });
};
