<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { annotate } from './index.js';
	import Mark from './Mark.svelte';

	let { href }: { href?: string } = $props();

	const clock = new Tween(0, { duration: 100 });
	const mark = annotate.scoped(clock);

	export function getClock() {
		return clock;
	}
</script>

<Mark {mark} as="a" type="underline" {href}>hello</Mark>
