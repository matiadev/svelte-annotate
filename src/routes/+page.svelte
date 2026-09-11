<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { Mark, annotate } from '$lib/index.js';
	import type { Snippet } from 'svelte';

	const underlineClock = new Tween(0, { duration: 400 });
	const highlightClock = new Tween(0, { duration: 400 });
	const circleClock = new Tween(0, { duration: 400 });
	const strikeClock = new Tween(0, { duration: 400 });
	const crossedClock = new Tween(0, { duration: 400 });
	const boxClock = new Tween(0, { duration: 400 });
	const bracketClock = new Tween(0, { duration: 400 });
	const multilineClock = new Tween(0, { duration: 400 });
	const sequenceClock = new Tween(0, { duration: 400 });

	const underlineMark = annotate.scoped(underlineClock);
	const highlightMark = annotate.scoped(highlightClock);
	const circleMark = annotate.scoped(circleClock);
	const strikeMark = annotate.scoped(strikeClock);
	const crossedMark = annotate.scoped(crossedClock);
	const boxMark = annotate.scoped(boxClock);
	const bracketMark = annotate.scoped(bracketClock);
	const multilineMark = annotate.scoped(multilineClock);
	const sequenceMark = annotate.scoped(sequenceClock);
	const still = annotate.scoped(1);

	function replay(clock: Tween<number>, end = 1) {
		void clock.set(0, { duration: 0 });
		clock.target = end;
	}
</script>

{#snippet header()}
	<header class="flex flex-col items-center gap-2 pb-16 text-center">
		<h1 class="text-5xl font-black tracking-tight">@sveltecraft/annotate</h1>
		<p class="text-xl text-neutral-300">Hand-drawn annotations for Svelte</p>
	</header>
{/snippet}

{#snippet section(title: string, clock?: Tween<number>, end = 1, body?: Snippet)}
	<section class="flex flex-col items-start gap-6 border-t border-white/10 py-16">
		<h2 class="text-4xl font-bold text-neutral-100">{title}</h2>
		<div class="text-2xl">
			{#if body}{@render body()}{/if}
		</div>
		{#if clock}
			<button
				class="mt-4 cursor-pointer rounded border border-white bg-transparent px-6 py-3 text-lg font-semibold text-neutral-100"
				onclick={() => replay(clock, end)}
			>
				Annotate
			</button>
		{/if}
	</section>
{/snippet}

{#snippet underline()}
	<p>
		Create a sketchy <Mark mark={underlineMark} type="underline" color="#f97316">underline</Mark> below
		an element.
	</p>
{/snippet}

{#snippet highlight()}
	<p>
		Creates a
		<Mark mark={highlightMark} type="highlight" color="#ffff00">highlight</Mark>
		effect as if marked by a highlighter.
	</p>
{/snippet}

{#snippet circle()}
	<p>
		Draw a <Mark mark={circleMark} type="circle" color="#ef4444" padding={12}>circle</Mark> around the
		element.
	</p>
{/snippet}

{#snippet strike()}
	<p>
		Draw a hand-drawn line through an element creating a
		<Mark mark={strikeMark} type="strike-through" color="#7c3aed">stroke-through</Mark>
		effect.
	</p>
{/snippet}

{#snippet crossed()}
	<p>
		To symbolize rejection, use a
		<Mark mark={crossedMark} type="crossed-off" color="#dc2626">crossed-off</Mark>
		effect on an element.
	</p>
{/snippet}

{#snippet box()}
	<p>
		This style draws a <Mark mark={boxMark} type="box" color="#16a34a" padding={12}>box</Mark>
		around the element.
	</p>
{/snippet}

{#snippet brackets()}
	<p class="max-w-2xl">
		<Mark mark={bracketMark} type="bracket" color="#4f46e5" brackets={['left', 'right']}>
			Create a hand-drawn bracket around a block (like a paragraph of text) on one or multiple sides
			of the block.
		</Mark>
	</p>
{/snippet}

{#snippet multiline()}
	<p class="max-w-2xl">
		<Mark mark={multilineMark} type="underline" color="#f97316" multiline>
			Ability to annotate inline content that can span multiple lines, no matter how the text wraps.
		</Mark>
	</p>
{/snippet}

{#snippet sequence()}
	<div class="flex flex-col gap-4">
		<p><Mark mark={sequenceMark} type="underline" color="#f97316" at={0}>first</Mark></p>
		<p><Mark mark={sequenceMark} type="underline" color="#f97316" at={1}>second</Mark></p>
		<p><Mark mark={sequenceMark} type="underline" color="#f97316" at={2}>third</Mark></p>
	</div>
{/snippet}

{#snippet noAnimation()}
	<p>
		Of course you don't have to animate the
		<Mark mark={still} type="underline" color="#f97316">mark</Mark>, it just shows up.
	</p>
{/snippet}

<div class="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
	{@render header()}
	{@render section('Underline', underlineClock, 1, underline)}
	{@render section('Highlight', highlightClock, 1, highlight)}
	{@render section('Circle', circleClock, 1, circle)}
	{@render section('Strike-Through', strikeClock, 1, strike)}
	{@render section('Crossed-Off', crossedClock, 1, crossed)}
	{@render section('Box', boxClock, 1, box)}
	{@render section('Brackets', bracketClock, 1, brackets)}
	{@render section('Multiple lines', multilineClock, 1, multiline)}
	{@render section('One after another', sequenceClock, 3, sequence)}
	{@render section('No Animation', undefined, 1, noAnimation)}
</div>
