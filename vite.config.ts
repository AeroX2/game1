import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

function stripRolldownOutputOptions() {
	const strip = (o: Record<string, unknown> | undefined) => {
		if (o && 'codeSplitting' in o) delete o.codeSplitting;
	};
	return {
		name: 'strip-rolldown-output-options',
		enforce: 'post' as const,
		configResolved(config: { build?: { rollupOptions?: { output?: unknown } } }) {
			const out = config.build?.rollupOptions?.output;
			if (out && typeof out === 'object' && !Array.isArray(out)) strip(out as Record<string, unknown>);
			if (Array.isArray(out)) out.forEach((o) => strip(o as Record<string, unknown>));
		},
		// Strip again when Rollup receives options (worker/SSR build may get config later)
		options(options: { output?: unknown }) {
			const out = options.output;
			if (out && typeof out === 'object' && !Array.isArray(out)) strip(out as Record<string, unknown>);
			if (Array.isArray(out)) out.forEach((o) => strip(o as Record<string, unknown>));
			return null;
		}
	};
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		// SvelteKit can pass Rolldown-only `codeSplitting` into output; worker build uses Rollup which rejects it.
		stripRolldownOutputOptions()
	]
});
