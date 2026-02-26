<script lang="ts">
	type Props = {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		bigStep?: number;
		label?: string;
	};

	let {
		value = $bindable(0),
		min = 0,
		max,
		step = 1,
		bigStep = 5,
		label
	}: Props = $props();

	function clamp(next: number): number {
		let n = Math.round(next);
		if (n < min) n = min;
		if (max != null && n > max) n = max;
		return n;
	}

	function add(amount: number) {
		value = clamp(value + amount);
	}

	$effect(() => {
		const next = clamp(value);
		if (next !== value) value = next;
	});
</script>

<div class="grid gap-1">
	{#if label}
		<span class="text-sm font-semibold">{label}</span>
	{/if}
	<div class="flex items-center gap-1">
		<button
			type="button"
			class="btn min-w-10 preset-tonal-surface px-2 text-lg"
			title="-{bigStep}"
			onclick={() => add(-bigStep)}
			disabled={value <= min}
		>
			−{bigStep}
		</button>
		<button
			type="button"
			class="btn min-w-10 preset-tonal-surface px-2 text-lg"
			title="-1"
			onclick={() => add(-step)}
			disabled={value <= min}
		>
			−1
		</button>
		<span
			class="min-w-12 flex-1 rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-2 text-center text-lg font-semibold tabular-nums"
			aria-live="polite"
		>
			{value}
		</span>
		<button
			type="button"
			class="btn min-w-10 preset-tonal-surface px-2 text-lg"
			title="+1"
			onclick={() => add(step)}
			disabled={max != null && value >= max}
		>
			+1
		</button>
		<button
			type="button"
			class="btn min-w-10 preset-tonal-surface px-2 text-lg"
			title="+{bigStep}"
			onclick={() => add(bigStep)}
			disabled={max != null && value >= max}
		>
			+{bigStep}
		</button>
	</div>
</div>
