<script lang="ts">
	import { annotate } from './index.js';
	import Mark from './Mark.svelte';

	const mark = annotate(99);

	let { cls, href }: { cls?: string; href?: string } = $props();
</script>

<Mark {mark} type="underline" class={cls} {href}>
	{#snippet child({ props })}
		<a class="user" {...props}>hello</a>
	{/snippet}
</Mark>
