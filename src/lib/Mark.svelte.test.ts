import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Fixture from './MarkFixture.test.svelte';
import ElFixture from './MarkElFixture.test.svelte';
import ChildFixture from './MarkChildFixture.test.svelte';
import ClockFixture from './MarkClockFixture.test.svelte';

describe('Mark component', () => {
	it('renders the chosen element with a painted overlay', async () => {
		const { container } = await render(Fixture);
		const target = container.firstElementChild;
		expect(target?.tagName).toBe('DIV');
		expect(target?.textContent).toContain('hello');
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('exposes the rendered element through bind:el', async () => {
		const { container } = await render(ElFixture);
		const output = container.querySelector('output');
		await vi.waitFor(() => expect(output?.textContent?.trim()).toBe('DIV target'));
		expect(container.querySelector('div')?.className).toBe('target');
	});

	it('renders a child snippet element and passes props through', async () => {
		const { container } = await render(ChildFixture, { cls: 'custom', href: '/docs' });
		const link = container.querySelector('a');
		await vi.waitFor(() => expect(link?.className).toBe('custom'));
		expect(link?.getAttribute('href')).toBe('/docs');
		expect(link?.textContent).toContain('hello');
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('keeps a class set on the child element when Mark passes none', async () => {
		const { container } = await render(ChildFixture);
		const link = container.querySelector('a');
		await vi.waitFor(() => expect(link?.className).toBe('user'));
		expect(link?.getAttribute('href')).toBeNull();
	});

	it('paints the annotation on the element from the child snippet', async () => {
		const { container } = await render(ChildFixture);
		await vi.waitFor(() => expect(container.querySelector('svg path')).not.toBeNull());
	});

	it('keeps the same overlay while the clock animates', async () => {
		const { container, component } = await render(ClockFixture);
		const clock = component.getClock();
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		clock.target = 1;
		await vi.waitFor(() => expect(clock.current).toBe(1));
		expect(container.querySelector('svg')).toBe(svg);
	});

	it('keeps the same overlay when pass-through props change', async () => {
		const { container, rerender } = await render(ClockFixture, { href: '/a' });
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		await rerender({ href: '/b' });
		expect(container.querySelector('a')?.getAttribute('href')).toBe('/b');
		expect(container.querySelector('svg')).toBe(svg);
	});
});
