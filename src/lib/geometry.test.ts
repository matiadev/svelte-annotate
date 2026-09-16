import { describe, expect, it } from 'vitest';
import {
	buildFillPlan,
	buildStrokePlan,
	easeInOutQuad,
	isLineType,
	normalizePadding,
	overlayDepth,
	resolveOptions,
	boundingBox,
	windowProgress
} from './geometry.js';
import type { AnnotateOptions, ContentBox, ResolvedOptions } from './geometry.js';

function options(
	over: Partial<AnnotateOptions> & { type: AnnotateOptions['type'] }
): ResolvedOptions {
	return resolveOptions(over);
}

const box: ContentBox = { x: 6, y: 6, width: 100, height: 40 };

describe('normalizePadding', () => {
	it('expands a single number to all sides', () => {
		expect(normalizePadding(5)).toEqual([5, 5, 5, 5]);
	});

	it('mirrors vertical and horizontal pairs', () => {
		expect(normalizePadding([4, 8])).toEqual([4, 8, 4, 8]);
	});

	it('keeps four side values in order', () => {
		expect(normalizePadding([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
	});
});

describe('resolveOptions', () => {
	it('fills every default', () => {
		const resolved = options({ type: 'underline' });
		expect(resolved).toMatchObject({
			color: 'currentColor',
			strokeWidth: 2.5,
			roughness: 1.6,
			seed: 7,
			padTop: 5,
			padRight: 5,
			padBottom: 5,
			padLeft: 5,
			iterations: 2,
			rtl: false,
			brackets: ['right'],
			multiline: false
		});
	});

	it('gives brackets roomier default padding', () => {
		const resolved = options({ type: 'bracket' });
		expect([resolved.padTop, resolved.padRight, resolved.padBottom, resolved.padLeft]).toEqual([
			12, 12, 12, 12
		]);
	});

	it('clamps iterations to at least one pass', () => {
		expect(options({ type: 'box', iterations: 0 }).iterations).toBe(1);
		expect(options({ type: 'box', iterations: 3 }).iterations).toBe(3);
	});

	it('wraps a single bracket side into an array', () => {
		expect(options({ type: 'bracket', brackets: 'left' }).brackets).toEqual(['left']);
		expect(options({ type: 'bracket', brackets: ['top', 'bottom'] }).brackets).toEqual([
			'top',
			'bottom'
		]);
	});

	it('rejects a missing or unknown type', () => {
		const bad = (type: string | undefined) => () =>
			options({ type: type as AnnotateOptions['type'] });
		expect(bad(undefined)).toThrow(/as its type/);
		expect(bad('typo')).toThrow(/as its type/);
	});
});

describe('buildStrokePlan', () => {
	it('draws underline passes below the text', () => {
		const plan = buildStrokePlan([box], options({ type: 'underline' }));
		expect(plan.groups).toHaveLength(1);
		expect(plan.groups[0]).toHaveLength(2);
		const first = plan.groups[0][0];
		const second = plan.groups[0][1];
		if (first.kind !== 'line' || second.kind !== 'line') throw new Error('expected lines');
		expect(first.y1).toBe(box.y + box.height + 4);
		expect(second.y1).toBe(box.y + box.height + 8);
		expect(first.x1).toBeLessThan(first.x2);
		expect(second.x1).toBeGreaterThan(second.x2);
	});

	it('starts underline from the right when rtl', () => {
		const plan = buildStrokePlan([box], options({ type: 'underline', rtl: true }));
		const first = plan.groups[0][0];
		if (first.kind !== 'line') throw new Error('expected line');
		expect(first.x1).toBeGreaterThan(first.x2);
	});

	it('draws strike-through across the vertical middle', () => {
		const plan = buildStrokePlan([box], options({ type: 'strike-through' }));
		expect(plan.groups).toHaveLength(1);
		const first = plan.groups[0][0];
		if (first.kind !== 'line') throw new Error('expected line');
		expect(first.y1).toBe(box.y + box.height / 2);
	});

	it('draws one rectangle per iteration for box', () => {
		const plan = buildStrokePlan([box], options({ type: 'box', iterations: 3 }));
		expect(plan.groups).toHaveLength(1);
		expect(plan.groups[0]).toHaveLength(3);
		const first = plan.groups[0][0];
		if (first.kind !== 'rect') throw new Error('expected rect');
		expect(first).toMatchObject({ x: box.x, y: box.y, width: box.width, height: box.height });
	});

	it('centers the ellipse on the box for circle', () => {
		const plan = buildStrokePlan([box], options({ type: 'circle' }));
		const first = plan.groups[0][0];
		if (first.kind !== 'ellipse') throw new Error('expected ellipse');
		expect(first).toMatchObject({
			cx: box.x + box.width / 2,
			cy: box.y + box.height / 2,
			width: box.width,
			height: box.height
		});
	});

	it('draws crossed-off as one leg per half', () => {
		const plan = buildStrokePlan([box], options({ type: 'crossed-off' }));
		expect(plan.groups).toHaveLength(2);
		const down = plan.groups[0][0];
		const up = plan.groups[1][0];
		if (down.kind !== 'line' || up.kind !== 'line') throw new Error('expected lines');
		expect([down.x1, down.y1, down.x2, down.y2]).toEqual([
			box.x,
			box.y,
			box.x + box.width,
			box.y + box.height
		]);
		expect([up.x1, up.y1, up.x2, up.y2]).toEqual([
			box.x + box.width,
			box.y,
			box.x,
			box.y + box.height
		]);
	});

	it('draws bracket sides in the requested order', () => {
		const plan = buildStrokePlan([box], options({ type: 'bracket', brackets: ['left', 'top'] }));
		expect(plan.groups).toHaveLength(2);
		const left = plan.groups[0][0];
		const top = plan.groups[1][0];
		if (left.kind !== 'linear' || top.kind !== 'linear') throw new Error('expected paths');
		expect(left.points[1]).toEqual([box.x, box.y]);
		expect(top.points[1]).toEqual([box.x, box.y]);
		expect(left.points[0][0]).toBeGreaterThan(box.x);
		expect(top.points[0][1]).toBeGreaterThan(box.y);
	});

	it('orders multiline underline groups top to bottom', () => {
		const upper: ContentBox = { x: 0, y: 0, width: 80, height: 20 };
		const lower: ContentBox = { x: 0, y: 24, width: 60, height: 20 };
		const plan = buildStrokePlan([upper, lower], options({ type: 'underline', iterations: 1 }));
		expect(plan.groups).toHaveLength(2);
		const first = plan.groups[0][0];
		const second = plan.groups[1][0];
		if (first.kind !== 'line' || second.kind !== 'line') throw new Error('expected lines');
		expect(first.y1).toBeLessThan(second.y1);
	});

	it('returns no groups for empty boxes', () => {
		const plan = buildStrokePlan(
			[{ x: 0, y: 0, width: 0, height: 0 }],
			options({ type: 'underline' })
		);
		expect(plan.groups).toEqual([]);
	});

	it('leaves highlight to the fill painter', () => {
		const plan = buildStrokePlan([box], options({ type: 'highlight' }));
		expect(plan.groups).toEqual([]);
	});
});

describe('buildFillPlan', () => {
	it('hugs each line with a slight overhang', () => {
		const plan = buildFillPlan([box], options({ type: 'highlight' }));
		expect(plan.rects).toHaveLength(2);
		expect(plan.rects[0]).toMatchObject({
			x: box.x - 2,
			width: box.width + 4,
			height: box.height * 0.88
		});
		expect(plan.rects[1].y).toBeGreaterThan(plan.rects[0].y);
		expect(plan.rects[1].seed).not.toBe(plan.rects[0].seed);
	});
});

describe('windowProgress', () => {
	it('passes plain progress through by default', () => {
		expect(windowProgress(0.4, 0, 1)).toBeCloseTo(0.4);
	});

	it('maps each mark to its own slice of a shared clock', () => {
		expect(windowProgress(0.5, 0, 1)).toBeCloseTo(0.5);
		expect(windowProgress(1.5, 1, 1)).toBeCloseTo(0.5);
		expect(windowProgress(0.5, 1, 1)).toBe(0);
		expect(windowProgress(2.5, 1, 1)).toBe(1);
	});

	it('stretches slices longer than one unit', () => {
		expect(windowProgress(8, 7, 1.5)).toBeCloseTo(2 / 3);
	});
});

describe('easeInOutQuad', () => {
	it('holds the ends and eases through the middle', () => {
		expect(easeInOutQuad(0)).toBe(0);
		expect(easeInOutQuad(1)).toBe(1);
		expect(easeInOutQuad(0.5)).toBeCloseTo(0.5);
		expect(easeInOutQuad(0.25)).toBeCloseTo(0.125);
	});
});

describe('helpers', () => {
	it('unions boxes into their bounding box', () => {
		expect(
			boundingBox([
				{ x: 0, y: 0, width: 10, height: 10 },
				{ x: 5, y: 20, width: 10, height: 10 }
			])
		).toEqual({ x: 0, y: 0, width: 15, height: 30 });
	});

	it('marks only line based types as line types', () => {
		expect(isLineType('underline')).toBe(true);
		expect(isLineType('strike-through')).toBe(true);
		expect(isLineType('highlight')).toBe(true);
		expect(isLineType('box')).toBe(false);
		expect(isLineType('bracket')).toBe(false);
	});

	it('reserves extra depth below underline strokes', () => {
		expect(overlayDepth('underline')).toBeGreaterThan(0);
		expect(overlayDepth('box')).toBe(0);
	});
});
