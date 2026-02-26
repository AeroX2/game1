import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyJson, roomStub } from '$lib/server/room-proxy';
import { getString, readJsonObject } from '$lib/shared/json';

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = await readJsonObject(request);
	const roomId = getString(body, 'roomId')?.trim().toUpperCase() ?? '';
	const name = getString(body, 'name');
	if (!roomId) {
		return json({ error: 'roomId is required.' }, { status: 400 });
	}

	const stub = roomStub(platform, roomId);
	const upstream = await proxyJson(stub, '/join', 'POST', { name });
	const payload = await upstream.json();
	return json({ roomId, ...payload }, { status: upstream.status });
};
