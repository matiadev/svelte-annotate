import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Fixture from './MarkFixture.svelte';

describe('Mark component', () => {
	it('renders the chosen element with a painted overlay', async () => {
		const { container } = await render(Fixture);
		const target = container.firstElementChild;
		expect(target?.tagName).toBe('DIV');
		expect(target?.textContent).toContain('hello');
		expect(container.querySelector('svg')).not.toBeNull();
	});
});
