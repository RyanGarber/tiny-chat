import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type {
	zAttachmentPart,
	zCommandPart,
	zPastePart,
	zQuotePart,
	zTextPart,
} from "#core/features/data/types/part.ts";

/**
 * The parts an editor holds whole, beside the text written around them.
 *
 * An attachment carries a file, a paste carries more lines than an input can
 * show, and a command and a quote both read as something other than what they
 * travel as. None of them is ever written into the text: wherever text has to
 * stand in one piece with them — an editor document being serialized, or a
 * message being rendered — each stands in it as a single marker character,
 * and the part itself travels beside it.
 */
export type zEditorPart =
	| zAttachmentPart
	| zCommandPart
	| zQuotePart
	| zPastePart;

export const EDITOR_PART_TYPES = [
	"attachment",
	"command",
	"quote",
	"paste",
] as const;

export type EditorPartType = (typeof EDITOR_PART_TYPES)[number];

/** An editor part written inline, beside the text around it. */
const INLINE_PART_TYPES: EditorPartType[] = ["attachment", "command"];

/**
 * The first of the characters a part stands in text as: the `n`th part of a
 * run is `MARKER_BASE + n`. They are taken from the Private Use Area, which no
 * Markdown syntax gives a meaning to and nothing the user types should hold.
 */
const MARKER_BASE = 0xe000;
const MARKER_LIMIT = 0x800;

const MARKERS = /[-]/g;

/** Text and the editor parts it is written around, in order. */
export type EditorRun = (zTextPart | zEditorPart)[];

export const EditorPartUtils = {
	types: EDITOR_PART_TYPES,

	is: (part: { type: string }): part is zEditorPart =>
		EDITOR_PART_TYPES.includes(part.type as EditorPartType),

	/** Whether the part is one a run of text and editor parts is made of. */
	isRun: (part: { type: string }): part is zTextPart | zEditorPart =>
		part.type === "text" || EditorPartUtils.is(part),

	/** The run of text and editor parts the list opens with. */
	toRun: (parts: readonly { type: string }[]): EditorRun => {
		const run: EditorRun = [];
		for (const part of parts) {
			if (!EditorPartUtils.isRun(part)) break;
			run.push(part);
		}
		return run;
	},

	/** Whether the part sits in a line of text rather than on its own. */
	isInline: (type: EditorPartType) => INLINE_PART_TYPES.includes(type),

	/** The character the `index`th part of a run stands in text as. */
	marker: (index: number) => String.fromCharCode(MARKER_BASE + index),

	/** The index of the part a marker stands for, or null if it is not one. */
	index: (character: string) => {
		const code = character.charCodeAt(0) - MARKER_BASE;
		return character.length === 1 && code >= 0 && code < MARKER_LIMIT
			? code
			: null;
	},

	/** Every marker character, for splitting text around them. */
	markers: () => new RegExp(MARKERS.source, "g"),

	/** Text with any marker character it happens to hold taken out. */
	strip: (text: string) => text.replace(MARKERS, ""),

	/**
	 * A run as one string, each part standing in it as its marker, and the
	 * parts the markers index into.
	 */
	join: (run: EditorRun): { source: string; parts: zEditorPart[] } => {
		const parts: zEditorPart[] = [];
		let source = "";

		for (const part of run) {
			if (part.type === "text") {
				source += EditorPartUtils.strip(part.value);
			} else if (parts.length < MARKER_LIMIT) {
				source += EditorPartUtils.marker(parts.length);
				parts.push(part);
			}
		}

		return { source, parts };
	},

	/**
	 * The inverse of {@link EditorPartUtils.join}: a string with markers in it
	 * cut back into the text and the parts they stand for. A marker with no
	 * part behind it is dropped.
	 */
	split: ({
		source,
		parts,
	}: {
		source: string;
		parts: readonly zEditorPart[];
	}): EditorRun => {
		const run: EditorRun = [];
		const text = (value: string) => {
			if (value)
				run.push({ id: CommonUtils.getRandomId(), type: "text", value });
		};

		let cursor = 0;
		for (const match of source.matchAll(EditorPartUtils.markers())) {
			text(source.slice(cursor, match.index));
			cursor = match.index + match[0].length;

			const index = EditorPartUtils.index(match[0]);
			const part = index === null ? undefined : parts[index];
			if (part) run.push(part);
		}
		text(source.slice(cursor));

		return run;
	},

	/**
	 * The body of a fenced block, when the whole of the text is one. Null when
	 * it is not fenced, so text that happens to contain fences is left alone.
	 */
	unwrapFence: (
		text: string,
	): { language: string | null; text: string } | null => {
		const trimmed = text.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
		const match = trimmed.match(/^(`{3,}|~{3,})([^\n`]*)\n([\s\S]*)\n\1$/);
		if (!match) return null;

		return {
			language: match[2].trim().split(/\s+/)[0] || null,
			text: match[3],
		};
	},

	/** A fenced block long enough that fences inside the text stay literal. */
	fence: (text: string, language?: string | null) => {
		const ticks = Math.max(
			3,
			...[...text.matchAll(/^`+/gm)].map((match) => match[0].length + 1),
		);
		const mark = "`".repeat(ticks);
		return `${mark}${language ?? ""}\n${text}\n${mark}`;
	},

	/**
	 * A part as the plain Markdown a reader would have written in its place,
	 * for wherever only text can go — an interjection, or a model that is not
	 * told about the part itself.
	 */
	toText: (part: zEditorPart): string => {
		if (part.type === "attachment") {
			const directory = part.content.type === "directory" ? "/" : "";
			return `@${part.label || part.source}${directory}`;
		}
		if (part.type === "command") {
			return `/${part.name}${part.argument ? ` ${part.argument}` : ""}`;
		}
		if (part.type === "quote") {
			return part.text.replace(/^/gm, "> ");
		}
		return EditorPartUtils.fence(part.text, part.language);
	},
} as const;
