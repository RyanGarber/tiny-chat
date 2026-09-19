import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type {
	zAttachmentPart,
	zCommandPart,
	zPastePart,
	zQuotePart,
} from "../types/part.ts";

/**
 * The parts an editor writes as a pointer rather than as itself.
 *
 * An attachment carries a file, a paste carries more lines than an input can
 * show, and a command and a quote both read as something other than what they
 * travel as. The editor document holds `:tag[]{id}` for each of them and the
 * part it points at is kept alongside, so neither runtime has to encode the
 * thing twice — once for the document and once for the message.
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

export const EditorPartUtils = {
	types: EDITOR_PART_TYPES,

	is: (part: { type: string }): part is zEditorPart =>
		EDITOR_PART_TYPES.includes(part.type as EditorPartType),

	/** Whether the part sits in a line of text rather than on its own. */
	isInline: (type: EditorPartType) => INLINE_PART_TYPES.includes(type),

	/**
	 * An attribute value, with the characters that would cut a directive short
	 * taken out of it.
	 */
	escape: (value: string) =>
		value.replace(/[&"\r\n]/g, (character) => {
			if (character === "&") return "&amp;";
			if (character === '"') return "&quot;";
			if (character === "\r") return "&#13;";
			return "&#10;";
		}),

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
	 * The directive an editor document holds a part as: its id and nothing
	 * else, so the payload is only ever written once — on the part.
	 */
	toPointer: ({ type, id }: { type: EditorPartType; id: string }) =>
		EditorPartUtils.isInline(type)
			? `:${type}[]{id="${id}"}`
			: `::${type}{id="${id}"}`,

	/**
	 * The directive a part is *displayed* as, which carries what a renderer
	 * needs to draw it and nothing a reader would have to resolve.
	 */
	toMarkdown: (part: zEditorPart): string => {
		const attributes = (values: Record<string, string | undefined>) =>
			CommonUtils.toAttributesString(
				Object.fromEntries(
					Object.entries(values)
						.filter(([, value]) => value !== undefined)
						.map(([key, value]) => [
							key,
							EditorPartUtils.escape(String(value)),
						]),
				),
			);

		if (part.type === "attachment") {
			return `:attachment[]{${attributes({
				source: part.source,
				name: part.label,
				"is-directory": part.content.type === "directory" ? "true" : undefined,
			})}}`;
		}

		if (part.type === "command") {
			return `:command[${part.argument ?? ""}]{${attributes({
				name: part.name,
				value: part.value,
			})}}`;
		}

		if (part.type === "quote") {
			return `:::quote{${attributes({ model: part.model })}}\n${part.text}\n:::`;
		}

		const fence = EditorPartUtils.fence(part.text, part.language);
		// A paste short enough to read goes in as the block it is; only one that
		// would bury the message around it is folded away behind its line count.
		if (!part.collapsed) return fence;
		return `:::paste{${attributes({ lines: String(part.lines) })}}\n${fence}\n:::`;
	},
} as const;
