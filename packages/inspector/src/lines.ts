import { blockContainer, NON_PROSE_SELECTOR, textNodes } from "./dom.js";

/**
 * Rendered line measurement — method id `rendered-line-rects@1`.
 * See docs/measurement-method.md. Summary:
 *  - Only continuous prose is measured: text in block containers inside the region,
 *    excluding headings, code/pre, tables, navigation, buttons, figcaptions and aria-hidden content.
 *  - Text is split into word segments (Intl.Segmenter). Each segment's client rects place it
 *    on a line; segments spanning several lines are re-split into grapheme clusters.
 *  - Inside one block container, a new line starts when a segment's glyph box overlaps the
 *    previous glyph box vertically by less than half the smaller height (explicit breaks,
 *    short lines, new columns), or when it is clearly below AND has moved back toward the
 *    line start for the block's direction (left for LTR, right for RTL).
 *  - Characters = grapheme clusters, so "é" composed or decomposed counts once and emoji
 *    sequences count once. Letters, digits, punctuation and inline code all count.
 *  - Whitespace counts once per rendered (non-zero-width) run, i.e. collapsed whitespace
 *    counts as one space; leading/trailing whitespace on a line is not counted.
 *  - Inline replaced content (img, svg, math, input) adds no characters; such lines are flagged `mixed`.
 *  - The last line of each block is flagged `final` and excluded from the CPL distribution.
 */
export const LINE_METHOD = "rendered-line-rects@1";

export interface Line {
  block: number;
  chars: number;
  widthPx: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  final: boolean;
  mixed: boolean;
}

export interface LineMeasurement {
  lines: Line[];
  blocks: Element[];
  characters: number;
  truncated: boolean;
  writingModeUnsupported: boolean;
  segmenter: "Intl.Segmenter" | "fallback";
  scripts: Record<string, number>;
  /** Raw text of measured blocks (used for the content fingerprint; never sent anywhere). */
  text: string;
}

interface Piece {
  chars: number;
  isSpace: boolean;
  rect: DOMRect;
}

const graphemeSeg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function countGraphemes(s: string): number {
  if (graphemeSeg) {
    let n = 0;
    for (const _ of graphemeSeg.segment(s)) n++;
    return n;
  }
  return Array.from(s).length;
}

function* segments(text: string, lang: string | undefined): Generator<{ segment: string; index: number }> {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(lang || undefined, { granularity: "word" });
    for (const s of seg.segment(text)) yield { segment: s.segment, index: s.index };
    return;
  }
  const re = /\s+|[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) yield { segment: m[0], index: m.index };
}

function visibleRects(range: Range): DOMRect[] {
  return Array.from(range.getClientRects()).filter((r) => r.width > 0.01 && r.height > 0);
}

function piecesForText(node: Text, preserveSpaces: boolean, lang: string | undefined): Piece[] {
  const out: Piece[] = [];
  const text = node.data;
  const range = document.createRange();
  for (const { segment, index } of segments(text, lang)) {
    const isSpace = /^\s+$/.test(segment);
    range.setStart(node, index);
    range.setEnd(node, index + segment.length);
    const rects = visibleRects(range);
    if (!rects.length) continue; // collapsed whitespace or invisible
    if (isSpace) {
      const chars = preserveSpaces ? segment.replace(/\n/g, "").length : 1;
      if (rects.length === 1) out.push({ chars, isSpace: true, rect: rects[0]! });
      else for (const r of rects) out.push({ chars: preserveSpaces ? 1 : 1, isSpace: true, rect: r });
      continue;
    }
    if (rects.length === 1) {
      out.push({ chars: countGraphemes(segment), isSpace: false, rect: rects[0]! });
      continue;
    }
    // Segment wraps across lines (hyphenation, CJK, overflow-wrap): split into graphemes.
    let offset = index;
    const graphemes = graphemeSeg ? Array.from(graphemeSeg.segment(segment), (g) => g.segment) : Array.from(segment);
    for (const g of graphemes) {
      range.setStart(node, offset);
      range.setEnd(node, offset + g.length);
      offset += g.length;
      const r = visibleRects(range)[0];
      if (r) out.push({ chars: 1, isSpace: /^\s+$/.test(g), rect: r });
    }
  }
  range.detach?.();
  return out;
}

const REPLACED = "img, svg, math, input, select, textarea, video, canvas, iframe, object";

/** Rough per-script character tally used to decide whether Latin-derived guidance applies. */
const SCRIPTS: [string, RegExp][] = [
  ["Latin", /\p{Script=Latin}/u],
  ["Han", /\p{Script=Han}/u],
  ["Hiragana/Katakana", /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ["Hangul", /\p{Script=Hangul}/u],
  ["Arabic", /\p{Script=Arabic}/u],
  ["Hebrew", /\p{Script=Hebrew}/u],
  ["Cyrillic", /\p{Script=Cyrillic}/u],
  ["Greek", /\p{Script=Greek}/u],
  ["Devanagari", /\p{Script=Devanagari}/u],
  ["Thai", /\p{Script=Thai}/u],
];

export function scriptTally(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ch of text) {
    if (/\s|\p{P}|\p{N}|\p{S}/u.test(ch)) continue;
    const hit = SCRIPTS.find(([, re]) => re.test(ch));
    const k = hit ? hit[0] : "Other";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function measureLines(region: Element, opts: { maxChars?: number } = {}): LineMeasurement {
  const maxChars = opts.maxChars ?? 40000;
  const blocks: Element[] = [];
  const blockIndex = new Map<Element, number>();
  const nodesByBlock = new Map<Element, Text[]>();
  const hasText = new Set<Element>();
  let writingModeUnsupported = false;
  for (const t of textNodes(region, { skipSelector: NON_PROSE_SELECTOR, includeWhitespace: true })) {
    const parent = t.parentElement;
    if (!parent || parent.closest(NON_PROSE_SELECTOR)) continue;
    const block = blockContainer(t);
    if (!block) continue;
    const cs = getComputedStyle(block);
    if (cs.writingMode && !cs.writingMode.startsWith("horizontal")) {
      writingModeUnsupported = true;
      continue;
    }
    if (!nodesByBlock.has(block)) nodesByBlock.set(block, []);
    nodesByBlock.get(block)!.push(t);
    if (t.data.trim()) hasText.add(block);
  }
  for (const [block] of nodesByBlock) {
    if (!hasText.has(block)) continue;
    blockIndex.set(block, blocks.length);
    blocks.push(block);
  }

  const lines: Line[] = [];
  let characters = 0;
  let truncated = false;
  let text = "";
  for (const block of blocks) {
    if (characters >= maxChars) {
      truncated = true;
      break;
    }
    const bi = blockIndex.get(block)!;
    const bcs = getComputedStyle(block);
    const rtl = bcs.direction === "rtl";
    const lang = (block.closest("[lang]")?.getAttribute("lang") ?? document.documentElement.lang) || undefined;
    const preserve = /^(pre|pre-wrap|break-spaces)$/.test(bcs.whiteSpace);
    const pieces: Piece[] = [];
    for (const t of nodesByBlock.get(block)!) {
      pieces.push(...piecesForText(t, preserve, lang));
      if (text.length < maxChars) text += t.data;
    }
    // Line breaks: a piece starts a new line when it is clearly below the previous
    // non-space piece AND it has moved back towards the line start (direction-aware).
    // Using both conditions keeps superscripts, large inline glyphs and bidi runs on their line.
    const blockLines: { pieces: Piece[] }[] = [];
    let cur: { pieces: Piece[] } | null = null;
    let prev: DOMRect | null = null;
    for (const p of pieces) {
      let newLine = !cur;
      if (cur && prev && !p.isSpace) {
        const cy = (p.rect.top + p.rect.bottom) / 2;
        const py = (prev.top + prev.bottom) / 2;
        const below = cy - py > 0.5 * Math.min(prev.height, p.rect.height);
        const reset = rtl ? p.rect.right > prev.right + 1 : p.rect.left < prev.left - 1;
        // Vertical overlap of the two glyph boxes relative to the smaller one. Glyphs on the
        // same line overlap heavily (superscripts, large inline glyphs); consecutive lines
        // overlap little even with tight leading; a new column does not overlap at all.
        const overlap = Math.max(0, Math.min(prev.bottom, p.rect.bottom) - Math.max(prev.top, p.rect.top)) / Math.max(1, Math.min(prev.height, p.rect.height));
        newLine = (below && reset) || overlap < 0.5;
      }
      if (newLine) {
        cur = { pieces: [] };
        blockLines.push(cur);
      }
      cur!.pieces.push(p);
      if (!p.isSpace) prev = p.rect;
    }
    const own: Line[] = [];
    for (const l of blockLines) {
      let a = 0;
      let b = l.pieces.length - 1;
      while (a <= b && l.pieces[a]!.isSpace) a++;
      while (b >= a && l.pieces[b]!.isSpace) b--;
      const kept = l.pieces.slice(a, b + 1);
      if (!kept.length) continue;
      const glyphs = kept.filter((p) => !p.isSpace);
      // Line top: median glyph top, robust to one tall inline element.
      const tops = glyphs.map((p) => p.rect.top).sort((x, y) => x - y);
      const bottoms = glyphs.map((p) => p.rect.bottom).sort((x, y) => x - y);
      const left = Math.min(...kept.map((p) => p.rect.left));
      const right = Math.max(...kept.map((p) => p.rect.right));
      const line: Line = {
        block: bi,
        chars: kept.reduce((s, p) => s + p.chars, 0),
        widthPx: Math.round((right - left) * 10) / 10,
        top: tops[Math.floor(tops.length / 2)]!,
        bottom: bottoms[Math.floor(bottoms.length / 2)]!,
        left,
        right,
        final: false,
        mixed: false,
      };
      own.push(line);
      characters += line.chars;
    }
    if (own.length) own[own.length - 1]!.final = true;
    const replaced = Array.from(block.querySelectorAll(REPLACED)).map((e) => e.getBoundingClientRect());
    for (const l of own) if (replaced.some((r) => r.bottom > l.top && r.top < l.bottom && r.width > 0)) l.mixed = true;
    lines.push(...own);
  }
  return { lines, blocks, characters, truncated, writingModeUnsupported, segmenter: graphemeSeg ? "Intl.Segmenter" : "fallback", scripts: scriptTally(text), text };
}

/** Median top-to-top distance between consecutive lines inside the same block. */
export function linePitch(lines: Line[]): number | null {
  const d: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1]!;
    const b = lines[i]!;
    if (a.block === b.block && !a.mixed && !b.mixed) d.push(b.top - a.top);
  }
  if (!d.length) return null;
  d.sort((x, y) => x - y);
  return d[Math.floor(d.length / 2)]!;
}
