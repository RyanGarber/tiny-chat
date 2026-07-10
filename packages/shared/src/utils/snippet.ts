/**
 * text.ts — Multi-snippet extraction for varied content (code, prose) and
 * varied query types (exact, fuzzy, regex, semantic / natural-language).
 *
 * Returns ALL good matches across the document, not just the single best one.
 * Each match window dynamically expands as long as surrounding text keeps
 * scoring well against the query.
 *
 * Pipeline:
 *  1. Collect every match position + local score from all applicable strategies.
 *  2. Build a score surface (Float32Array) over the document by spreading each
 *     hit's score across a Gaussian-like radius.
 *  3. Find all peaks above a quality threshold → snippet anchors.
 *  4. Grow each anchor outward while the score stays above an expansion floor.
 *  5. Merge overlapping / touching windows.
 *  6. Snap boundaries to word/newline breaks and render each window.
 *  7. Join with ' … '.
 */

import fuzzysort from "fuzzysort";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract all relevant snippets of `text` for a given `query`, dynamically
 * expanding each window while surrounding text keeps matching well.
 *
 * @param text         Source document (code or plain English).
 * @param query        String (keywords / phrase / natural-language) or RegExp.
 * @param baseWindow   Starting window width in characters (default 160).
 *                     Windows may grow beyond this when content warrants it.
 * @returns            Matched snippets joined by ' … ', each possibly prefixed
 *                     or suffixed with '…' when the document continues.
 */
export function snippetText(
	text: string,
	query: string | RegExp,
	baseWindow = 160,
): string {
	if (!text) return "";

	// ----- Collect raw hit positions with scores ----------------------------
	const hits = collectHits(text, query, baseWindow);

	if (!hits.length) return fallback(text, baseWindow);

	// ----- Build score surface over the document ----------------------------
	const surface = buildScoreSurface(text.length, hits, baseWindow);

	// ----- Find peak anchors ------------------------------------------------
	const anchors = findPeaks(surface, baseWindow);

	if (!anchors.length) return fallback(text, baseWindow);

	// ----- Grow each anchor into a dynamic window ---------------------------
	const windows = anchors.map((anchor) =>
		growWindow(surface, anchor, baseWindow),
	);

	// ----- Merge overlapping / adjacent windows -----------------------------
	const merged = mergeWindows(windows, baseWindow);

	// ----- Render and join --------------------------------------------------
	const snippets = merged
		.map(([s, e]) => renderWindow(text, s, e))
		.filter(Boolean);

	if (!snippets.length) return fallback(text, baseWindow);

	// Strip leading/trailing ellipses from each fragment before joining so the
	// join separator (' … ') is the only ellipsis between adjacent windows.
	const stripped = snippets.map((s, idx) => {
		let result = s;
		if (idx > 0) result = result.replace(/^…\s*/, "");
		if (idx < snippets.length - 1) result = result.replace(/\s*…$/, "");
		return result;
	});

	return stripped.join(" … ");
}

// ---------------------------------------------------------------------------
// Hit collection — delegates to per-strategy scorers
// ---------------------------------------------------------------------------

interface Hit {
	pos: number; // character offset in text
	score: number; // normalised [0, 1]
}

function collectHits(
	text: string,
	query: string | RegExp,
	baseWindow: number,
): Hit[] {
	const hits: Hit[] = [];

	if (query instanceof RegExp) {
		// Regex: collect every match site
		const flags = query.flags.includes("g") ? query.flags : `${query.flags}g`;
		const re = new RegExp(query.source, flags);
		let m: RegExpExecArray | null;
		while (true) {
			m = re.exec(text);
			if (!m) break;
			hits.push({ pos: m.index, score: 1.0 });
		}
		// Also try lowercase version if no hits
		if (!hits.length) {
			const reLower = new RegExp(query.source, flags);
			const lower = text.toLowerCase();
			while (true) {
				m = reLower.exec(lower);
				if (!m) break;
				hits.push({ pos: m.index, score: 0.9 });
			}
		}
		return hits;
	}

	const queryStr = query.trim();
	if (!queryStr) return hits;

	const lower = text.toLowerCase();
	const terms = tokenise(queryStr);
	const semanticTerms = terms.filter((t) => t.length > 2 && !STOP_WORDS.has(t));

	// --- Exact substring hits (high confidence) ----------------------------
	for (const term of terms) {
		const t = term.toLowerCase();
		let from = 0;
		while (true) {
			const i = lower.indexOf(t, from);
			if (i === -1) break;
			// Score by term length relative to query — longer term = more signal
			const score = 0.5 + 0.5 * (t.length / Math.max(1, queryStr.length));
			hits.push({ pos: i, score: Math.min(1, score) });
			from = i + 1;
		}
	}

	// --- Semantic / stemmed hits (medium confidence) -----------------------
	const stemHitMap = new Map<string, number[]>();
	for (const term of semanticTerms) {
		const stem = simpleStem(term);
		if (stem === term) continue; // already covered by exact
		let from = 0;
		while (true) {
			const i = lower.indexOf(stem, from);
			if (i === -1) break;
			const positions = stemHitMap.get(stem) ?? [];
			positions.push(i);
			stemHitMap.set(stem, positions);
			from = i + 1;
		}
	}
	for (const positions of stemHitMap.values()) {
		for (const pos of positions) {
			hits.push({ pos, score: 0.45 });
		}
	}

	// --- Fuzzy hits (lower confidence, catches misspellings / partials) ----
	if (queryStr.length >= 3) {
		const chunkSize = baseWindow * 2;
		const step = Math.max(1, Math.floor(chunkSize * 0.5));
		// Fuzzy threshold: don't bother if exact hits already cover entire text
		const hasDenseExact = hits.length > text.length / baseWindow;
		if (!hasDenseExact) {
			for (let offset = 0; offset < text.length; offset += step) {
				const chunk = text.slice(offset, offset + chunkSize);
				const result = fuzzysort.single(queryStr, chunk);
				if (!result || result.score < -600) continue;
				const normScore = Math.max(0, (result.score + 1000) / 1000) * 0.6;
				const firstIdx = result.indexes[0] ?? 0;
				hits.push({ pos: offset + firstIdx, score: normScore });
			}
		}
	}

	return hits;
}

// ---------------------------------------------------------------------------
// Score surface
// ---------------------------------------------------------------------------

/**
 * Spread each hit's score across the document using a Gaussian-like kernel
 * so that nearby matches reinforce each other.
 */
function buildScoreSurface(
	length: number,
	hits: Hit[],
	baseWindow: number,
): Float32Array {
	const surface = new Float32Array(length);
	const radius = Math.floor(baseWindow / 2);

	for (const { pos, score } of hits) {
		if (pos < 0 || pos >= length) continue;
		// Spread score with a linear falloff over `radius` characters
		const lo = Math.max(0, pos - radius);
		const hi = Math.min(length - 1, pos + radius);
		for (let i = lo; i <= hi; i++) {
			const dist = Math.abs(i - pos);
			const weight = 1 - dist / (radius + 1);
			surface[i] = Math.min(1, surface[i] + score * weight);
		}
	}

	return surface;
}

// ---------------------------------------------------------------------------
// Peak detection
// ---------------------------------------------------------------------------

/**
 * Return the centre position of every local maximum that is above
 * the quality threshold. Peaks that are too close together are deduplicated
 * by keeping only the higher one.
 */
function findPeaks(surface: Float32Array, baseWindow: number): number[] {
	const PEAK_THRESHOLD = 0.25;
	const MIN_PEAK_DISTANCE = Math.floor(baseWindow * 0.75);

	const candidates: { pos: number; score: number }[] = [];

	let i = 1;
	while (i < surface.length - 1) {
		if (
			surface[i] >= PEAK_THRESHOLD &&
			surface[i] >= surface[i - 1] &&
			surface[i] >= surface[i + 1]
		) {
			candidates.push({ pos: i, score: surface[i] });
			// Skip ahead to avoid reporting the entire plateau as many peaks
			i += Math.max(1, MIN_PEAK_DISTANCE);
		} else {
			i++;
		}
	}

	// Deduplicate: if two candidates are within MIN_PEAK_DISTANCE, keep higher
	const peaks: number[] = [];
	for (let c = 0; c < candidates.length; c++) {
		const { pos, score } = candidates[c];
		const next = candidates[c + 1];
		if (next && next.pos - pos < MIN_PEAK_DISTANCE) {
			// Keep whichever has the higher score
			if (next.score >= score) continue;
			c++; // skip next
		}
		peaks.push(pos);
	}

	return peaks;
}

// ---------------------------------------------------------------------------
// Dynamic window growth
// ---------------------------------------------------------------------------

/**
 * Starting from `anchor`, expand left and right as long as the score surface
 * stays above the expansion floor. Returns [start, end] character offsets.
 */
function growWindow(
	surface: Float32Array,
	anchor: number,
	baseWindow: number,
): [number, number] {
	const EXPANSION_FLOOR = 0.08; // minimum score to keep expanding
	const GAP_TOLERANCE = 20; // chars of sub-threshold allowed before stopping

	let start = Math.max(0, anchor - Math.floor(baseWindow / 2));
	let end = Math.min(surface.length, anchor + Math.ceil(baseWindow / 2));

	// Expand left
	let gap = 0;
	for (let i = start - 1; i >= 0; i--) {
		if (surface[i] >= EXPANSION_FLOOR) {
			start = i;
			gap = 0;
		} else {
			gap++;
			if (gap > GAP_TOLERANCE) break;
		}
	}

	// Expand right
	gap = 0;
	for (let i = end; i < surface.length; i++) {
		if (surface[i] >= EXPANSION_FLOOR) {
			end = i + 1;
			gap = 0;
		} else {
			gap++;
			if (gap > GAP_TOLERANCE) break;
		}
	}

	return [start, end];
}

// ---------------------------------------------------------------------------
// Window merging
// ---------------------------------------------------------------------------

function mergeWindows(
	windows: [number, number][],
	baseWindow: number,
): [number, number][] {
	if (!windows.length) return [];

	// Sort by start position
	windows.sort((a, b) => a[0] - b[0]);

	const MIN_GAP = Math.floor(baseWindow * 0.5); // gaps smaller than this get bridged
	const merged: [number, number][] = [windows[0]];

	for (let i = 1; i < windows.length; i++) {
		const last = merged[merged.length - 1];
		const [s, e] = windows[i];
		if (s - last[1] <= MIN_GAP) {
			// Merge
			last[1] = Math.max(last[1], e);
		} else {
			merged.push([s, e]);
		}
	}

	return merged;
}

// ---------------------------------------------------------------------------
// Window rendering
// ---------------------------------------------------------------------------

/**
 * Render a [start, end] window from `text`, snapping boundaries to
 * newline/word breaks and adding '…' markers where the document continues.
 */
function renderWindow(text: string, start: number, end: number): string {
	const n = text.length;

	// Snap start backward to a newline or forward to a word boundary
	if (start > 0) {
		const nlBefore = text.lastIndexOf("\n", start + 40);
		if (nlBefore >= start - 40 && nlBefore < start + 40) {
			start = nlBefore + 1;
		} else {
			// Snap to next space so we don't cut a word
			const spAfter = text.indexOf(" ", start);
			if (spAfter !== -1 && spAfter < start + 30) start = spAfter + 1;
		}
	}

	// Snap end to a newline or space
	if (end < n) {
		const nlAfter = text.indexOf("\n", end - 30);
		if (nlAfter !== -1 && nlAfter <= end + 30) {
			end = nlAfter;
		} else {
			const spBefore = text.lastIndexOf(" ", end);
			if (spBefore !== -1 && spBefore > start) end = spBefore;
		}
	}

	start = Math.max(0, start);
	end = Math.min(n, end);

	const snippet = text.slice(start, end).trim();
	if (!snippet) return "";

	return (start > 0 ? "…" : "") + snippet + (end < n ? "…" : "");
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function fallback(text: string, windowSize: number): string {
	if (text.length <= windowSize) return text;
	const cut = text.lastIndexOf(" ", windowSize);
	return `${text.slice(0, cut > 0 ? cut : windowSize)}…`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tokenise a string into lowercase word tokens. */
function tokenise(input: string): string[] {
	return input
		.toLowerCase()
		.split(/[\s\-_/\\.,;:!?'"()[\]{}<>|@#$%^&*+=~`]+/)
		.filter((t) => t.length > 0);
}

const STOP_WORDS = new Set([
	"a",
	"an",
	"the",
	"and",
	"or",
	"but",
	"in",
	"on",
	"at",
	"to",
	"for",
	"of",
	"with",
	"by",
	"from",
	"as",
	"is",
	"was",
	"are",
	"were",
	"be",
	"been",
	"being",
	"have",
	"has",
	"had",
	"do",
	"does",
	"did",
	"will",
	"would",
	"could",
	"should",
	"may",
	"might",
	"shall",
	"can",
	"not",
	"no",
	"it",
	"its",
	"this",
	"that",
	"these",
	"those",
	"i",
	"you",
	"he",
	"she",
	"we",
	"they",
	"what",
	"which",
	"who",
	"how",
	"when",
	"where",
	"why",
	"if",
	"then",
	"so",
	"just",
	"about",
]);

/** Very simple morphological stemmer (covers common English suffixes). */
function simpleStem(word: string): string {
	if (word.length < 5) return word;
	if (word.endsWith("ing")) return word.slice(0, -3);
	if (word.endsWith("tion")) return word.slice(0, -3);
	if (word.endsWith("ness")) return word.slice(0, -4);
	if (word.endsWith("ment")) return word.slice(0, -4);
	if (word.endsWith("able") || word.endsWith("ible")) return word.slice(0, -4);
	if (word.endsWith("ed")) return word.slice(0, -2);
	if (word.endsWith("er")) return word.slice(0, -2);
	if (word.endsWith("ly")) return word.slice(0, -2);
	if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
	return word;
}
