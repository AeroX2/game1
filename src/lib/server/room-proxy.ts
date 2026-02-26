import { error } from '@sveltejs/kit';

type PlatformLike = App.Platform | undefined;

export function roomStub(platform: PlatformLike, roomId: string) {
	const namespace = platform?.env?.ROOMS;
	if (!namespace) {
		throw error(500, 'Cloudflare Durable Object binding ROOMS is not available.');
	}

	const id = namespace.idFromName(roomId);
	return namespace.get(id);
}

export async function proxyJson(
	stub: App.DurableObjectStub,
	path: string,
	method = 'GET',
	body?: unknown
): Promise<Response> {
	return stub.fetch(`https://room${path}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
}
