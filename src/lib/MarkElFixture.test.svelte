<script lang="ts">
	import { annotate } from './index.js';
	import Mark from './Mark.svelte';

	const mark = annotate(99);

	let el = $state<HTMLElement | null>(null);
</script>

<Mark {mark} as="div" type="underline" class="target" bind:el>hello</Mark>
<output data-testid="ref">{el ? el.tagName : 'unset'} {el?.className}</output>
