import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Fixture from './MarkFixture.svelte';
import ElFixture from './MarkElFixture.svelte';
import ChildFixture from './MarkChildFixture.svelte';

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
});
