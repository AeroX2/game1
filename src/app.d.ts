// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface DurableObjectId {}

		interface DurableObjectStub {
			fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
		}

		interface DurableObjectNamespace {
			idFromName(name: string): DurableObjectId;
			get(id: DurableObjectId): DurableObjectStub;
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				ROOMS: DurableObjectNamespace;
			};
		}
	}
}

export {};
