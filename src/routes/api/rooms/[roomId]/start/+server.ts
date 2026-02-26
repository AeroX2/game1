import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyJson, roomStub } from '$lib/server/room-proxy';
import { readJsonObject } from '$lib/shared/json';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const roomId = params.roomId.toUpperCase();
	const body = await readJsonObject(request);
	const stub = roomStub(platform, roomId);
	const upstream = await proxyJson(stub, '/start', 'POST', body);
	const payload = await upstream.json();
	return json(payload, { status: upstream.status });
};
