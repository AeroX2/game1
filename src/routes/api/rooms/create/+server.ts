import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyJson, roomStub } from '$lib/server/room-proxy';
import { getString, readJsonObject } from '$lib/shared/json';

function makeRoomId(): string {
	return crypto.randomUUID().slice(0, 8).toUpperCase();
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = await readJsonObject(request);
	const name = getString(body, 'name');
	const roomId = makeRoomId();
	const stub = roomStub(platform, roomId);
	const upstream = await proxyJson(stub, '/create', 'POST', { name });
	const payload = await upstream.json();
	return json({ roomId, ...payload }, { status: upstream.status });
};
