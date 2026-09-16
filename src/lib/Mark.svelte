<script lang="ts">
	import { getMarkBinder } from './annotate.svelte.js';
	import type { Snippet } from 'svelte';
	import type { AnnotateOptions, BoundAnnotate } from './annotate.svelte.js';

	interface MarkChildArgs {
		props: Record<string, unknown>;
	}

	interface Props extends AnnotateOptions {
		mark?: BoundAnnotate;
		class?: string;
		as?: keyof HTMLElementTagNameMap;
		el?: HTMLElement | null;
		children?: Snippet;
		child?: Snippet<[MarkChildArgs]>;
		[key: string]: unknown;
	}

	let {
		mark,
		class: cls = '',
		as: tag = 'span',
		el = $bindable<HTMLElement | null>(),
		children,
		child,
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
	const spread = $derived({
		...(cls ? { class: cls } : {}),
		...active(annotation),
		...props
	});
</script>

{#if child}
	{@render child({ props: spread })}
{:else}
	<svelte:element this={tag} bind:this={el} {...spread}>
		{@render children?.()}
	</svelte:element>
{/if}
