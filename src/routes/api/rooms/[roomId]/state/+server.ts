import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyJson, roomStub } from '$lib/server/room-proxy';

export const GET: RequestHandler = async ({ params, platform }) => {
	const roomId = params.roomId.toUpperCase();
	const stub = roomStub(platform, roomId);
	const upstream = await proxyJson(stub, '/state', 'GET');
	const payload = await upstream.json();
	return json(payload, { status: upstream.status });
};
