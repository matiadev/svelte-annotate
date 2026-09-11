import { RoughGenerator, SVGRenderer } from '@sveltecraft/rough';
import {
	buildFillPlan,
	buildStrokePlan,
	easeInOutQuad,
	isLineType,
	overlayDepth,
	renderFillNodes,
	applyFillProgress,
	renderStrokeNodes,
	applyStrokeProgress,
	resolveOptions,
	boundingBox,
	windowProgress
} from './geometry.js';
import type {
	AnnotateOptions,
	ContentBox,
	FillPlan,
	StrokePlan,
	RenderedStrokeGroups
} from './geometry.js';
import { createAttachmentKey } from 'svelte/attachments';
import type { Attachment } from 'svelte/attachments';

export type { AnnotateOptions };

export type ProgressSource = number | (() => number) | { current: number } | { clock: number };

// one key for every mark so spreads diff stably instead of remounting
const MARK_KEY = createAttachmentKey();

// shared hosts restore their position only after the last mark leaves
const hostClaims = new WeakMap<HTMLElement, { users: number; previous: string }>();

export type Mark = Attachment<HTMLElement> & Record<symbol, Attachment<HTMLElement>>;

export interface BoundAnnotate {
	(options: AnnotateOptions): Mark;
}

let ambient: ProgressSource | undefined = undefined;

export function getMarkBinder(): BoundAnnotate {
	if (ambient === undefined) {
		throw new Error(
			'Missing mark binder: call annotate(scene) or annotate(() => value) once, or pass mark explicitly.'
		);
	}
	return annotate.scoped(ambient);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// one value works after @attach and inside a spread
function toMark(run: Attachment<HTMLElement>): Mark {
	return Object.assign(run, { [MARK_KEY]: run });
}

// scoped binder that never touches the default clock, use it when two clocks live together
function scoped(source: ProgressSource): BoundAnnotate;
function scoped(source: ProgressSource, options: AnnotateOptions): Mark;
function scoped(source: ProgressSource, options?: AnnotateOptions) {
	if (options === undefined)
		return (bound: AnnotateOptions) => toMark(attachAnnotation(source, bound));
	return toMark(attachAnnotation(source, options));
}

export interface Annotate {
	(source: ProgressSource): BoundAnnotate;
	(source: ProgressSource, options: AnnotateOptions): Mark;
	scoped: {
		(source: ProgressSource): BoundAnnotate;
		(source: ProgressSource, options: AnnotateOptions): Mark;
	};
}

function annotateImpl(source: ProgressSource): BoundAnnotate;
function annotateImpl(source: ProgressSource, options: AnnotateOptions): Mark;
function annotateImpl(source: ProgressSource, options?: AnnotateOptions) {
	// any bind declares the default clock, last one wins
	ambient = source;
	if (options === undefined) return scoped(source);
	return scoped(source, options);
}

export const annotate: Annotate = Object.assign(annotateImpl, { scoped });

// numbers paint once while getters and holders stay live, current wins over clock
export function toReader(source: ProgressSource): () => number {
	if (typeof source === 'function') return source;
	if (typeof source === 'number') return () => source;
	if (typeof source === 'object' && source !== null) {
		const holder = source as Partial<{ current: unknown; clock: unknown }>;
		if (typeof holder.current === 'number') return () => holder.current as number;
		if (typeof holder.clock === 'number') return () => holder.clock as number;
	}
	throw new Error(
		'annotate needs a number, a getter, or an object with a numeric current or clock field.'
	);
}

function attachAnnotation(
	source: ProgressSource,
	options: AnnotateOptions
): Attachment<HTMLElement> {
	const resolved = resolveOptions(options);
	const read = toReader(source);
	return (target) => {
		// overlay lives on the nearest block box so wrapped inlines never anchor it
		const host = target.parentElement ?? target;
		let claim = hostClaims.get(host);
		if (!claim) {
			claim = { users: 0, previous: host.style.position };
			if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
			hostClaims.set(host, claim);
		}
		claim.users += 1;

		const svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('aria-hidden', 'true');
		svg.style.position = 'absolute';
		svg.style.pointerEvents = 'none';
		svg.style.overflow = 'visible';
		const layer = document.createElementNS(SVG_NS, 'g');
		svg.appendChild(layer);
		host.appendChild(svg);

		const renderer = new SVGRenderer(svg);
		const generator = new RoughGenerator();

		// SVG is anchored to the padding box so only the border offsets it
		let shiftLeft = 0;
		let shiftTop = 0;
		function refreshMetrics() {
			shiftLeft = host.clientLeft;
			shiftTop = host.clientTop;
		}
		refreshMetrics();

		// fragments sharing a line top belong to one wrapped line
		function measureLines(): ContentBox[] {
			const origin = host.getBoundingClientRect();
			const fragments: ContentBox[] = [];
			target.childNodes.forEach((node) => {
				const range = document.createRange();
				if (node.nodeType === Node.TEXT_NODE) range.selectNode(node);
				else range.selectNodeContents(node);
				for (const rect of Array.from(range.getClientRects())) {
					if (rect.width > 0 && rect.height > 0) {
						fragments.push({
							x: rect.left - origin.left,
							y: rect.top - origin.top,
							width: rect.width,
							height: rect.height
						});
					}
				}
			});
			if (fragments.length === 0) return [];
			const smallest = Math.min(...fragments.map((entry) => entry.height));
			const tolerance = Math.max(2, smallest / 2);
			const rows: { top: number; box: ContentBox }[] = [];
			for (const fragment of fragments) {
				const row = rows.find((entry) => Math.abs(entry.top - fragment.y) <= tolerance);
				if (row) row.box = boundingBox([row.box, fragment]);
				else rows.push({ top: fragment.y, box: fragment });
			}
			rows.sort((a, b) => a.top - b.top);
			return rows.map((entry) => entry.box);
		}

		// repaint reads live size and progress, rebuilds geometry only when lines move
		let warnedBadProgress = false;
		let cachedKey: string | null = null;
		let cachedStrokePlan: StrokePlan | null = null;
		let cachedStroke: RenderedStrokeGroups | null = null;
		let cachedFillPlan: FillPlan | null = null;
		function clearCache() {
			cachedKey = null;
			cachedStrokePlan = null;
			cachedStroke = null;
			cachedFillPlan = null;
		}
		function repaint() {
			// range boxes work for inline targets where offset size reads zero
			const found = measureLines();
			if (found.length === 0) {
				layer.replaceChildren();
				clearCache();
				return;
			}
			const multi = resolved.multiline && isLineType(resolved.type);
			const kept = multi ? found : [boundingBox(found)];
			const content = boundingBox(kept);
			const lines = kept.map((line) => ({
				...line,
				x: line.x - content.x + resolved.padLeft,
				y: line.y - content.y + resolved.padTop
			}));
			const progress = easeInOutQuad(windowProgress(read(), resolved.at, resolved.span));
			// non-finite progress paints nothing so hide instead of corrupting the layer
			if (!Number.isFinite(progress)) {
				if (!warnedBadProgress) {
					warnedBadProgress = true;
					console.warn('annotate computed a non finite progress, hiding the mark.');
				}
				layer.replaceChildren();
				clearCache();
				return;
			}
			const key = lines
				.map((line) =>
					[line.x, line.y, line.width, line.height].map((n) => Math.round(n * 10) / 10).join(',')
				)
				.join(';');
			if (resolved.type === 'highlight') {
				if (key !== cachedKey || cachedFillPlan === null) {
					const depth = overlayDepth(resolved.type);
					const overlayWidth = content.width + resolved.padLeft + resolved.padRight;
					const overlayHeight = content.height + resolved.padTop + resolved.padBottom + depth;
					svg.setAttribute('width', `${overlayWidth}`);
					svg.setAttribute('height', `${overlayHeight}`);
					svg.setAttribute('viewBox', `0 0 ${overlayWidth} ${overlayHeight}`);
					// SVG anchors to the padding box while measures start at the border box
					svg.style.left = `${content.x - resolved.padLeft - shiftLeft}px`;
					svg.style.top = `${content.y - resolved.padTop - shiftTop}px`;
					const plan = buildFillPlan(lines, resolved);
					renderFillNodes(renderer, generator, layer, plan, {
						color: resolved.color,
						roughness: resolved.roughness
					});
					cachedFillPlan = plan;
					cachedKey = key;
				}
				applyFillProgress(layer, progress, resolved.rtl);
				return;
			}
			if (key !== cachedKey || cachedStroke === null || cachedStrokePlan === null) {
				const depth = overlayDepth(resolved.type);
				const overlayWidth = content.width + resolved.padLeft + resolved.padRight;
				const overlayHeight = content.height + resolved.padTop + resolved.padBottom + depth;
				svg.setAttribute('width', `${overlayWidth}`);
				svg.setAttribute('height', `${overlayHeight}`);
				svg.setAttribute('viewBox', `0 0 ${overlayWidth} ${overlayHeight}`);
				// SVG anchors to the padding box while measures start at the border box
				svg.style.left = `${content.x - resolved.padLeft - shiftLeft}px`;
				svg.style.top = `${content.y - resolved.padTop - shiftTop}px`;
				const plan = buildStrokePlan(lines, resolved);
				cachedStroke = renderStrokeNodes(renderer, generator, layer, plan, {
					color: resolved.color,
					strokeWidth: resolved.strokeWidth,
					roughness: resolved.roughness
				});
				cachedStrokePlan = plan;
				cachedKey = key;
			}
			applyStrokeProgress(cachedStroke, cachedStrokePlan, progress);
		}

		// resize and text edits refresh metrics while ticks reuse them
		function refresh() {
			refreshMetrics();
			cachedKey = null;
			repaint();
		}
		const observer = new ResizeObserver(refresh);
		observer.observe(target);
		if (host !== target) observer.observe(host);
		// text edits that keep their size still move every line
		const mutations = new MutationObserver((records) => {
			if (records.every((record) => svg.contains(record.target))) return;
			refresh();
		});
		mutations.observe(target, { childList: true, characterData: true, subtree: true });
		let alive = true;
		// late web fonts shift every line after each tween has settled
		document.fonts.ready.then(() => {
			if (alive) refresh();
		});
		$effect(() => {
			read();
			repaint();
		});

		return () => {
			alive = false;
			observer.disconnect();
			mutations.disconnect();
			svg.remove();
			const entry = hostClaims.get(host);
			if (entry) {
				entry.users -= 1;
				if (entry.users <= 0) {
					hostClaims.delete(host);
					host.style.position = entry.previous;
				}
			}
		};
	};
}
