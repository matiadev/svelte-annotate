import { describe, expect, it, vi } from 'vitest';
import { annotate, getMarkBinder, toReader } from './annotate.svelte';

describe('spreadable mark', () => {
	it('is callable and carries its own attachment key', () => {
		const mark = annotate(() => 1);
		const spread = mark({ type: 'underline', at: 0 });
		expect(typeof spread).toBe('function');
		const keys = Object.getOwnPropertySymbols(spread);
		expect(keys).toHaveLength(1);
		expect(typeof spread[keys[0]!]).toBe('function');
	});

	it('leaks no string keys into spreads', () => {
		const mark = annotate(() => 1);
		expect(Object.keys(mark({ type: 'underline', at: 0 }))).toEqual([]);
	});

	it('returns the same shape from the direct form', () => {
		const mark = annotate(() => 1, { type: 'box', at: 0 });
		expect(typeof mark).toBe('function');
		expect(Object.getOwnPropertySymbols(mark)).toHaveLength(1);
	});
});

describe('toReader', () => {
	it('freezes plain numbers', () => {
		expect(toReader(2)()).toBe(2);
	});

	it('passes getters through untouched', () => {
		let value = 1;
		const get = () => value;
		expect(toReader(get)).toBe(get);
		value = 3;
		expect(toReader(get)()).toBe(3);
	});

	it('tracks current live', () => {
		const holder = { current: 1 };
		const read = toReader(holder);
		expect(read()).toBe(1);
		holder.current = 4;
		expect(read()).toBe(4);
	});

	it('tracks clock live', () => {
		const holder = { clock: 1 };
		const read = toReader(holder);
		expect(read()).toBe(1);
		holder.clock = 4;
		expect(read()).toBe(4);
	});

	it('prefers current over clock', () => {
		expect(toReader({ current: 1, clock: 2 })()).toBe(1);
	});

	it('does not read the value while binding', () => {
		let reads = 0;
		const holder = {
			get current() {
				reads += 1;
				return 0.5;
			}
		};
		const read = toReader(holder);
		expect(reads).toBe(0);
		expect(read()).toBe(0.5);
		expect(reads).toBe(1);
	});

	it('rejects anything without a readable field', () => {
		const bad = (value: unknown) => () => toReader(value as { current: number });
		expect(bad({})).toThrow(/current or clock/);
		expect(bad(null)).toThrow(/current or clock/);
		expect(bad({ type: 'underline' })).toThrow(/current or clock/);
	});
});

describe('ambient binder', () => {
	it('throws a helpful error when nothing bound yet', async () => {
		vi.resetModules();
		const fresh = await import('./annotate.svelte');
		expect(() => fresh.getMarkBinder()).toThrow(/annotate\(\(\) => value\)/);
	});

	it('binds the ambient clock through annotate', () => {
		annotate(() => 2);
		const spread = getMarkBinder()({ type: 'highlight', at: 1 });
		expect(typeof spread).toBe('function');
		expect(Object.getOwnPropertySymbols(spread)).toHaveLength(1);
	});

	it('either overload declares the ambient clock', () => {
		annotate(() => 5, { type: 'box', at: 0 });
		expect(() => getMarkBinder()).not.toThrow();
	});
});

describe('scoped binder', () => {
	it('returns both shapes while leaving the ambient clock alone', async () => {
		vi.resetModules();
		const fresh = await import('./annotate.svelte');
		const spread = fresh.annotate.scoped(() => 1)({ type: 'underline', at: 0 });
		expect(typeof spread).toBe('function');
		expect(Object.getOwnPropertySymbols(spread)).toHaveLength(1);
		const direct = fresh.annotate.scoped(() => 1, { type: 'box', at: 0 });
		expect(typeof direct).toBe('function');
		expect(() => fresh.getMarkBinder()).toThrow(/annotate\(\(\) => value\)/);
	});
});
