import type { RoughGenerator, SVGRenderer } from '@sveltecraft/rough';

export type AnnotationType =
	'underline' | 'box' | 'circle' | 'highlight' | 'strike-through' | 'crossed-off' | 'bracket';
export type BracketSide = 'left' | 'right' | 'top' | 'bottom';
export type Padding =
	number | readonly [number, number] | readonly [number, number, number, number];

export interface SketchStyle {
	color?: string;
	strokeWidth?: number;
	roughness?: number;
	seed?: number;
}

export interface AnnotateOptions extends SketchStyle {
	type: AnnotationType;
	padding?: Padding;
	iterations?: number;
	rtl?: boolean;
	brackets?: BracketSide | readonly BracketSide[];
	multiline?: boolean;
	at?: number;
	span?: number;
}

export interface ResolvedOptions {
	type: AnnotationType;
	color: string;
	strokeWidth: number;
	roughness: number;
	seed: number;
	padTop: number;
	padRight: number;
	padBottom: number;
	padLeft: number;
	iterations: number;
	rtl: boolean;
	brackets: BracketSide[];
	multiline: boolean;
	at: number;
	span: number;
}

export type Shape =
	| { kind: 'line'; x1: number; y1: number; x2: number; y2: number; seed: number }
	| { kind: 'rect'; x: number; y: number; width: number; height: number; seed: number }
	| { kind: 'ellipse'; cx: number; cy: number; width: number; height: number; seed: number }
	| { kind: 'linear'; points: [number, number][]; seed: number };

export interface ContentBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface StrokePlan {
	groups: Shape[][];
}

export interface FillRect {
	x: number;
	y: number;
	width: number;
	height: number;
	seed: number;
}

export interface FillPlan {
	rects: FillRect[];
}

const UNDERLINE_DEPTH = 12;
const UNDERLINE_DROP = 4;
const PASS_GAP = 4;
const BRACKET_TICK = 10;
const HIGHLIGHT_OPACITY = 0.8;
const HIGHLIGHT_OVERHANG = 2;

export function normalizePadding(padding: Padding): [number, number, number, number] {
	if (typeof padding === 'number') return [padding, padding, padding, padding];
	if (padding.length === 2) return [padding[0], padding[1], padding[0], padding[1]];
	return [padding[0], padding[1], padding[2], padding[3]];
}

function normalizeBrackets(
	brackets: BracketSide | readonly BracketSide[] | undefined
): BracketSide[] {
	if (brackets === undefined) return ['right'];
	if (typeof brackets === 'string') return [brackets];
	return [...brackets];
}

export function resolveOptions(options: AnnotateOptions): ResolvedOptions {
	// brackets sit outside the content so they start with roomier padding
	const defaultPadding = options.type === 'bracket' ? 12 : 5;
	const [padTop, padRight, padBottom, padLeft] = normalizePadding(
		options.padding ?? defaultPadding
	);
	const brackets = normalizeBrackets(options.brackets);
	return {
		type: options.type,
		color: options.color ?? 'currentColor',
		strokeWidth: options.strokeWidth ?? 2.5,
		roughness: options.roughness ?? 1.6,
		seed: options.seed ?? 7,
		padTop,
		padRight,
		padBottom,
		padLeft,
		iterations: Math.max(1, Math.round(options.iterations ?? 2)),
		rtl: options.rtl ?? false,
		brackets,
		multiline: options.multiline ?? false,
		at: options.at ?? 0,
		span: options.span ?? 1
	};
}

export function overlayDepth(type: AnnotationType): number {
	return type === 'underline' ? UNDERLINE_DEPTH : 0;
}

const LINE_TYPES: AnnotationType[] = ['underline', 'strike-through', 'highlight'];

export function isLineType(type: AnnotationType): boolean {
	return LINE_TYPES.includes(type);
}

function clampToUnit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

// one shared clock can drive many marks when each takes its own slice
export function windowProgress(value: number, at: number, span: number): number {
	const width = span > 0 ? span : 1;
	return clampToUnit((value - at) / width);
}

// every mark draws with the same stroke feel no matter where its slice sits
export function easeInOutQuad(value: number): number {
	return value < 0.5 ? 2 * value * value : -1 + (4 - 2 * value) * value;
}

export function boundingBox(lines: ContentBox[]): ContentBox {
	const x = Math.min(...lines.map((line) => line.x));
	const y = Math.min(...lines.map((line) => line.y));
	const farX = Math.max(...lines.map((line) => line.x + line.width));
	const farY = Math.max(...lines.map((line) => line.y + line.height));
	return { x, y, width: farX - x, height: farY - y };
}

function directedLine(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	forward: boolean,
	seed: number
): Shape {
	if (forward) return { kind: 'line', x1, y1, x2, y2, seed };
	return { kind: 'line', x1: x2, y1: y2, x2: x1, y2: y1, seed };
}

function passDirection(pass: number, rtl: boolean): boolean {
	const ltr = pass % 2 === 0;
	return rtl ? !ltr : ltr;
}

function horizontalPasses(
	x: number,
	y: number,
	width: number,
	options: ResolvedOptions,
	seedOffset: number
): Shape[] {
	const passes: Shape[] = [];
	for (let i = 0; i < options.iterations; i += 1) {
		// passes alternate direction so the stroke feels hand drawn
		passes.push(
			directedLine(
				x,
				y + i * PASS_GAP,
				x + width,
				y + i * PASS_GAP,
				passDirection(i, options.rtl),
				options.seed + seedOffset + i
			)
		);
	}
	return passes;
}

function diagonalPasses(
	box: ContentBox,
	corner: 'down' | 'up',
	options: ResolvedOptions,
	seedOffset: number
): Shape[] {
	const passes: Shape[] = [];
	for (let i = 0; i < options.iterations; i += 1) {
		const seed = options.seed + seedOffset + i;
		if (corner === 'down') {
			passes.push(
				directedLine(
					box.x,
					box.y,
					box.x + box.width,
					box.y + box.height,
					passDirection(i, options.rtl),
					seed
				)
			);
		} else {
			passes.push(
				directedLine(
					box.x + box.width,
					box.y,
					box.x,
					box.y + box.height,
					passDirection(i, options.rtl),
					seed
				)
			);
		}
	}
	return passes;
}

function rectPasses(box: ContentBox, options: ResolvedOptions, seedOffset: number): Shape[] {
	const passes: Shape[] = [];
	for (let i = 0; i < options.iterations; i += 1) {
		passes.push({
			kind: 'rect',
			x: box.x,
			y: box.y,
			width: box.width,
			height: box.height,
			seed: options.seed + seedOffset + i
		});
	}
	return passes;
}

function ellipsePasses(box: ContentBox, options: ResolvedOptions, seedOffset: number): Shape[] {
	const passes: Shape[] = [];
	for (let i = 0; i < options.iterations; i += 1) {
		passes.push({
			kind: 'ellipse',
			cx: box.x + box.width / 2,
			cy: box.y + box.height / 2,
			width: box.width,
			height: box.height,
			seed: options.seed + seedOffset + i
		});
	}
	return passes;
}

function bracketPoints(box: ContentBox, side: BracketSide): [number, number][] {
	const x0 = box.x;
	const x1 = box.x + box.width;
	const y0 = box.y;
	const y1 = box.y + box.height;
	switch (side) {
		// ticks point inward so each side reads as a frame
		case 'right':
			return [
				[x1 - BRACKET_TICK, y0],
				[x1, y0],
				[x1, y1],
				[x1 - BRACKET_TICK, y1]
			];
		case 'left':
			return [
				[x0 + BRACKET_TICK, y0],
				[x0, y0],
				[x0, y1],
				[x0 + BRACKET_TICK, y1]
			];
		case 'top':
			return [
				[x0, y0 + BRACKET_TICK],
				[x0, y0],
				[x1, y0],
				[x1, y0 + BRACKET_TICK]
			];
		case 'bottom':
			return [
				[x0, y1 - BRACKET_TICK],
				[x0, y1],
				[x1, y1],
				[x1, y1 - BRACKET_TICK]
			];
	}
}

function bracketSide(
	box: ContentBox,
	side: BracketSide,
	options: ResolvedOptions,
	seedOffset: number
): Shape[] {
	const points = bracketPoints(box, side);
	const passes: Shape[] = [];
	for (let i = 0; i < options.iterations; i += 1) {
		passes.push({ kind: 'linear', points, seed: options.seed + seedOffset + i });
	}
	return passes;
}

export function buildStrokePlan(lines: ContentBox[], options: ResolvedOptions): StrokePlan {
	const visible = lines.filter((line) => line.width > 0 && line.height > 0);
	if (visible.length === 0) return { groups: [] };
	switch (options.type) {
		case 'underline':
			return {
				groups: visible.flatMap((line, index) => [
					horizontalPasses(
						line.x,
						line.y + line.height + UNDERLINE_DROP,
						line.width,
						options,
						index * 16
					)
				])
			};
		case 'strike-through':
			return {
				groups: visible.flatMap((line, index) => [
					horizontalPasses(line.x, line.y + line.height / 2, line.width, options, index * 16)
				])
			};
		case 'box':
			return { groups: [rectPasses(boundingBox(visible), options, 0)] };
		case 'circle':
			return { groups: [ellipsePasses(boundingBox(visible), options, 0)] };
		case 'crossed-off': {
			// one leg per half so the cross draws in two moves
			const box = boundingBox(visible);
			return {
				groups: [diagonalPasses(box, 'down', options, 0), diagonalPasses(box, 'up', options, 8)]
			};
		}
		case 'bracket': {
			// one side per group so sides draw in the requested order
			const box = boundingBox(visible);
			return {
				groups: options.brackets.map((side, index) => bracketSide(box, side, options, index * 16))
			};
		}
		default:
			return { groups: [] };
	}
}

function drawShape(
	renderer: SVGRenderer,
	generator: RoughGenerator,
	shape: Shape,
	style: { color: string; strokeWidth: number; roughness: number }
): SVGGElement {
	const base = { stroke: style.color, strokeWidth: style.strokeWidth, roughness: style.roughness };
	switch (shape.kind) {
		case 'line':
			return renderer.draw(
				generator.line(shape.x1, shape.y1, shape.x2, shape.y2, { ...base, seed: shape.seed })
			);
		case 'rect':
			return renderer.draw(
				generator.rectangle(shape.x, shape.y, shape.width, shape.height, {
					...base,
					seed: shape.seed
				})
			);
		case 'ellipse':
			return renderer.draw(
				generator.ellipse(shape.cx, shape.cy, shape.width, shape.height, {
					...base,
					seed: shape.seed
				})
			);
		case 'linear':
			return renderer.draw(
				generator.linearPath(
					shape.points.map(([x, y]): [number, number] => [x, y]),
					{ ...base, seed: shape.seed }
				)
			);
	}
}

export function buildFillPlan(lines: ContentBox[], options: ResolvedOptions): FillPlan {
	const visible = lines.filter((line) => line.width > 0 && line.height > 0);
	return {
		// marker hugs the text, second pass darkens overlaps like marker streaks
		rects: visible.flatMap((line, index) => [
			{
				x: line.x - HIGHLIGHT_OVERHANG,
				y: line.y + line.height * 0.06,
				width: line.width + HIGHLIGHT_OVERHANG * 2,
				height: line.height * 0.88,
				seed: options.seed + index * 16
			},
			{
				x: line.x - HIGHLIGHT_OVERHANG,
				y: line.y + line.height * 0.06 + 2,
				width: line.width + HIGHLIGHT_OVERHANG * 2,
				height: line.height * 0.88,
				seed: options.seed + index * 16 + 1
			}
		])
	};
}

export function paintFill(
	renderer: SVGRenderer,
	generator: RoughGenerator,
	layer: SVGGElement,
	plan: FillPlan,
	style: { color: string; roughness: number; rtl: boolean },
	progress: number
): void {
	renderFillNodes(renderer, generator, layer, plan, style);
	applyFillProgress(layer, progress, style.rtl);
}

export interface RenderedStrokeGroups {
	groups: { paths: SVGPathElement[]; lengths: number[] }[];
}

export function renderFillNodes(
	renderer: SVGRenderer,
	generator: RoughGenerator,
	layer: SVGGElement,
	plan: FillPlan,
	style: { color: string; roughness: number }
): void {
	layer.replaceChildren();
	for (const rect of plan.rects) {
		const node = renderer.draw(
			generator.rectangle(rect.x, rect.y, rect.width, rect.height, {
				fill: style.color,
				fillStyle: 'solid',
				stroke: 'none',
				roughness: style.roughness,
				seed: rect.seed
			})
		);
		layer.appendChild(node);
	}
	// multiply stains the paper instead of covering it
	layer.style.mixBlendMode = 'multiply';
	layer.style.opacity = `${HIGHLIGHT_OPACITY}`;
}

export function applyFillProgress(layer: SVGGElement, progress: number, rtl: boolean): void {
	const clamped = clampToUnit(progress);
	// wipe across the layer so the marker feels dragged
	const hidden = (1 - clamped) * 100;
	layer.style.clipPath = rtl ? `inset(0 0 0 ${hidden}%)` : `inset(0 ${hidden}% 0 0)`;
}
export function paintStrokes(
	renderer: SVGRenderer,
	generator: RoughGenerator,
	layer: SVGGElement,
	plan: StrokePlan,
	style: { color: string; strokeWidth: number; roughness: number },
	progress: number
): void {
	const rendered = renderStrokeNodes(renderer, generator, layer, plan, style);
	applyStrokeProgress(rendered, plan, progress);
}

export function renderStrokeNodes(
	renderer: SVGRenderer,
	generator: RoughGenerator,
	layer: SVGGElement,
	plan: StrokePlan,
	style: { color: string; strokeWidth: number; roughness: number }
): RenderedStrokeGroups {
	layer.replaceChildren();
	layer.style.clipPath = '';
	layer.style.opacity = '';
	layer.style.mixBlendMode = '';
	// measure once so ticks only move dashes
	const groups = plan.groups.map((shapes) => {
		const nodes = shapes.map((shape) =>
			layer.appendChild(drawShape(renderer, generator, shape, style))
		);
		const paths = nodes.flatMap((node) => Array.from(node.querySelectorAll('path')));
		return { paths, lengths: paths.map((path) => path.getTotalLength()) };
	});
	return { groups };
}

export function applyStrokeProgress(
	rendered: RenderedStrokeGroups,
	plan: StrokePlan,
	progress: number
): void {
	const clamped = clampToUnit(progress);
	// sweep groups in order and stagger paths inside each group
	rendered.groups.forEach((group, index) => {
		const groupProgress = clampToUnit(clamped * plan.groups.length - index);
		group.paths.forEach((path, pathIndex) => {
			const length = group.lengths[pathIndex] ?? 0;
			const local = clampToUnit(groupProgress * group.paths.length - pathIndex);
			path.style.strokeDasharray = `${length}`;
			path.style.strokeDashoffset = `${length * (1 - local)}`;
		});
	});
}
