import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { DirectiveUtils } from "@tiny-chat/core/src/features/data/utils/DirectiveUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useMarkdownDataStore } from "../../message/stores/useMarkdownDataStore.ts";
import { useAtomStore } from "../stores/useAtomStore.ts";
import type { Atom, AtomKind, AtomText, AtomToken } from "../types/atom.ts";
import type { EditorNode } from "../types/node.ts";
import { EditorNodeUtils } from "./EditorNodeUtils.ts";
import { PASTE_LINE_LIMIT, PasteUtils } from "./PasteUtils.ts";

/** The directives a message carries that an atom can be read back out of. */
const DIRECTIVES = ["command", "attachment", "paste", "quote"] as const;

/**
 * Atoms: the runs of a plain text buffer that stand in for the Markdown a
 * message travels as.
 *
 * A command, an attachment and a long paste all read badly in an input — a
 * directive is unreadable, and a pasted file is unusable — so the buffer holds
 * a short stand-in for each of them and the Markdown is kept alongside, in
 * {@link useAtomStore}. {@link AtomUtils.serialize} puts the Markdown back
 * before the message is sent, and {@link AtomUtils.deserialize} takes it back
 * out when a message is loaded for editing. A long paste travels as
 * `:::paste`.
 */
export const AtomUtils = {
	/** Every atom currently standing in the input. */
	atoms: () => useAtomStore.getState().atoms,

	/**
	 * Take an atom into the registry and report the text that stands for it in
	 * the buffer.
	 *
	 * The same Markdown always comes back as the same atom, and two atoms never
	 * share the text they stand as — otherwise one would be serialized as the
	 * other. Pass `content` to drop the atoms it no longer holds.
	 */
	register: ({
		content,
		kind,
		text,
		markdown,
	}: {
		content?: string;
		kind: AtomKind;
		text: AtomText;
		markdown: string;
	}): string => {
		const { setAtoms } = useAtomStore.getState();

		const atoms = AtomUtils.atoms().filter(
			(atom) => content === undefined || content.includes(atom.text),
		);

		const existing = atoms.find(
			(atom) => atom.kind === kind && atom.markdown === markdown,
		);
		if (existing) {
			setAtoms(atoms);
			return existing.text;
		}

		let unique = "";
		for (let index = 0; !unique; index++) {
			const candidate = text(index);
			if (!atoms.some((atom) => atom.text === candidate)) unique = candidate;
		}

		setAtoms([...atoms, { kind, text: unique, markdown }]);

		return unique;
	},

	/** The atom a run of the buffer stands for, or null when it stands alone. */
	find: ({ atoms, text }: { atoms: Atom[]; text: string }) =>
		atoms.find((atom) => atom.text === text) ?? null,

	/**
	 * Matches every atom in a buffer. Longer atoms are tried first, so one that
	 * starts with another is still taken whole. Null when there are none.
	 */
	pattern: ({ atoms }: { atoms: Atom[] }): RegExp | null => {
		if (!atoms.length) return null;

		const alternation = [...atoms]
			.sort((a, b) => b.text.length - a.text.length)
			.map((atom) => CommonUtils.escapeRegex(atom.text))
			.join("|");

		return new RegExp(alternation, "g");
	},

	/** Every atom standing in a buffer, in order. */
	tokens: ({
		content,
		atoms,
	}: {
		content: string;
		atoms: Atom[];
	}): AtomToken[] => {
		const pattern = AtomUtils.pattern({ atoms });
		if (!pattern) return [];

		return [...content.matchAll(pattern)].flatMap((match) => {
			const atom = AtomUtils.find({ atoms, text: match[0] });
			if (!atom) return [];
			return {
				...atom,
				start: match.index,
				end: match.index + match[0].length,
			};
		});
	},

	/**
	 * The buffer with every atom blanked out, character for character, so that
	 * what is being typed can be read out of it without a command or a file name
	 * standing inside an atom being taken for one.
	 */
	mask: ({ content, atoms }: { content: string; atoms: Atom[] }) => {
		const pattern = AtomUtils.pattern({ atoms });
		if (!pattern) return content;

		return content.replace(pattern, (match) => match.replace(/[^\n]/g, " "));
	},

	/** The buffer with every atom put back as the Markdown it stands for. */
	serialize: ({
		content,
		atoms: given,
	}: {
		content: string;
		atoms?: Atom[];
	}): string => {
		const atoms = given ?? AtomUtils.atoms();

		const pattern = AtomUtils.pattern({ atoms });
		if (!pattern) return content;

		return content.replace(pattern, (match) => {
			const atom = AtomUtils.find({ atoms, text: match });
			if (!atom) return match;
			// A paste is a container directive, which only parses as a block.
			if (atom.kind === "paste" || atom.kind === "quote") {
				return `\n${atom.markdown}\n`;
			}
			return atom.markdown;
		});
	},

	/** Adapt a shared editor node to the short stand-in used by a plain buffer. */
	fromNode: ({ content, node }: { content: string; node: EditorNode }) => {
		const markdown = EditorNodeUtils.toMarkdown(node);
		if (node.type === "attachment") {
			const attachment = useMarkdownDataStore.getState().attachments[node.id];
			if (!attachment) return "";
			return AtomUtils.attachment({
				content,
				id: node.id,
				source: attachment.source,
				directory: attachment.content.type === "directory",
				label: attachment.label,
				markdown,
			});
		}
		if (node.type === "command") {
			return AtomUtils.command({
				content,
				name: node.name,
				value: node.value,
				markdown,
			});
		}
		if (node.type === "paste") {
			return (
				AtomUtils.paste({
					content,
					text: node.text,
					markdown,
					lines: node.lines,
				}) ?? node.text
			);
		}
		return AtomUtils.quote({
			content,
			model: node.model,
			markdown,
		});
	},

	/**
	 * The inverse: a message's Markdown as a buffer, with every directive in it
	 * taken back into an atom. Replaces the registry, since the atoms that were
	 * standing in the buffer this one takes over from are gone with it.
	 */
	deserialize: (markdown: string) => {
		useAtomStore.getState().setAtoms([]);

		return DirectiveUtils.extractFromMarkdown(markdown, ...DIRECTIVES)
			.map(({ text, directive }) => {
				if (directive?.tag === "command") {
					return AtomUtils.command({
						name: directive.attributes.name,
						value: directive.textContent,
						markdown: text,
					});
				}
				if (directive?.tag === "attachment") {
					const id = directive.attributes.id;
					const attachment = useMarkdownDataStore.getState().attachments[id];
					if (!attachment) return text;
					return AtomUtils.attachment({
						id,
						source: attachment.source,
						directory: attachment.content.type === "directory",
						label: attachment.label,
						markdown: text,
					});
				}
				if (directive?.tag === "paste") {
					const parsed = Number(directive.attributes.lines);
					return (
						AtomUtils.paste({
							markdown: text,
							text: "",
							lines: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
						}) ?? text
					);
				}
				if (directive?.tag === "quote") {
					return AtomUtils.quote({
						model: directive.attributes.model,
						markdown: text,
					});
				}
				return text;
			})
			.join("");
	},

	/**
	 * An atom for a command, which stands as the command was typed: its name,
	 * and the argument it was given.
	 */
	command: ({
		content,
		name,
		value,
		markdown,
	}: {
		content?: string;
		name?: string;
		value?: string;
		markdown: string;
	}) => {
		const written = `/${name ?? ""}${value ? ` ${value}` : ""}`;

		return AtomUtils.register({
			content,
			kind: "command",
			text: (index) => (index ? `${written} #${index + 1}` : written),
			markdown,
		});
	},

	/** A quote atom is supported by plain buffers even when their UI does not expose it. */
	quote: ({
		content,
		model,
		markdown,
	}: {
		content?: string;
		model?: string;
		markdown: string;
	}) =>
		AtomUtils.register({
			content,
			kind: "quote",
			text: (index) =>
				index
					? `[Quoted ${model ?? "message"} #${index + 1}]`
					: `[Quoted ${model ?? "message"}]`,
			markdown,
		}),

	/**
	 * An atom for an attachment, which stands as its name alone. Two files of
	 * the same name are told apart by as much of their path as it takes.
	 *
	 * An upload is mounted under its id, which reads as nothing at all, so one
	 * carries a `label` and stands as that instead of as its path.
	 */
	attachment: ({
		content,
		id,
		source,
		directory,
		label,
		markdown,
	}: {
		content?: string;
		id: string;
		source?: string;
		directory?: boolean;
		label?: string;
		markdown: string;
	}) => {
		const path = label
			? [label]
			: (source ?? "").split(/[\\/]+/).filter(Boolean);
		const trailing = directory ? "/" : "";

		return AtomUtils.register({
			content,
			kind: "attachment",
			text: (index) => {
				if (index < path.length) {
					return `@${path.slice(path.length - index - 1).join("/")}${trailing}`;
				}
				return `@${PathUtils.name({ path })}${trailing} #${index - path.length + 2}`;
			},
			markdown: markdown || `:attachment[]{id="${id}"}`,
		});
	},

	/**
	 * An atom for a paste too long to read in an input, which stands as the
	 * lines it spans. Null when the paste is short enough to go in as it is.
	 *
	 * Pass `markdown` when the paste is already a `:::paste` directive, so it
	 * is not wrapped again.
	 */
	paste: ({
		content,
		text,
		markdown,
		lines,
	}: {
		content?: string;
		text: string;
		markdown?: string;
		lines?: number;
	}) => {
		const pasted = PasteUtils.normalize(text);
		const count = lines ?? pasted.split("\n").length;
		if (!markdown && count < PASTE_LINE_LIMIT) return null;

		const written = `[${count} pasted lines]`;

		return AtomUtils.register({
			content,
			kind: "paste",
			text: (index) =>
				index ? `[${count} pasted lines #${index + 1}]` : written,
			markdown: markdown ?? PasteUtils.markdown(pasted),
		});
	},
} as const;
