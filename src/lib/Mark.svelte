<script lang="ts">
	import { getMarkBinder } from './annotate.svelte.js';
	import type { Snippet } from 'svelte';
	import type { AnnotateOptions, BoundAnnotate } from './annotate.svelte.js';

	interface Props extends AnnotateOptions {
		mark?: BoundAnnotate;
		class?: string;
		as?: keyof HTMLElementTagNameMap;
		children: Snippet;
		[key: string]: unknown;
	}

	let {
		mark,
		class: cls = '',
		as: tag = 'span',
		children,
		type,
		color,
		padding,
		strokeWidth,
		roughness,
		seed,
		iterations,
		rtl,
		brackets,
		multiline,
		at,
		span,
		...props
	}: Props = $props();

	const active = $derived(mark ?? getMarkBinder());
	const annotation = $derived({
		type,
		color,
		padding,
		strokeWidth,
		roughness,
		seed,
		iterations,
		rtl,
		brackets,
		multiline,
		at,
		span
	});
</script>

<svelte:element this={tag} class={cls} {...active(annotation)} {...props}>
	{@render children()}
</svelte:element>
