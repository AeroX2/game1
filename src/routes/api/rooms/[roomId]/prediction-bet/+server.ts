import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyJson, roomStub } from '$lib/server/room-proxy';
import { getString, readJsonObject } from '$lib/shared/json';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const roomId = params.roomId.toUpperCase();
	const body = await readJsonObject(request);
	const bettorId = getString(body, 'bettorId');
	const targetPlayerId = getString(body, 'targetPlayerId');
	const predictedWords = typeof body.predictedWords === 'number' ? body.predictedWords : undefined;
	const stake = typeof body.stake === 'number' ? body.stake : undefined;
	const skip = body.skip === true;
	const stub = roomStub(platform, roomId);
	const upstream = await proxyJson(stub, '/prediction-bet', 'POST', {
		bettorId,
		targetPlayerId,
		predictedWords,
		stake,
		skip
	});
	const payload = await upstream.json();
	return json(payload, { status: upstream.status });
};
