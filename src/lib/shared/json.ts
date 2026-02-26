function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
	try {
		const parsed = await request.json();
		if (isRecord(parsed)) {
			return parsed;
		}
		return {};
	} catch {
		return {};
	}
}

export function getString(
	record: Record<string, unknown>,
	key: string
): string | undefined {
	const value = record[key];
	return typeof value === 'string' ? value : undefined;
}
