<script lang="ts">
	import { annotate } from './index.js';
	import Mark from './Mark.svelte';

	const mark = annotate(99);
</script>

<Mark {mark} as="div" type="underline">hello</Mark>
