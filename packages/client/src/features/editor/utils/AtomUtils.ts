import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { DirectiveUtils } from "@tiny-chat/core/src/features/data/utils/DirectiveUtils.ts";
import {
	EDITOR_PART_TYPES,
	EditorPartUtils,
} from "@tiny-chat/core/src/features/data/utils/EditorPartUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useAtomStore } from "../stores/useAtomStore.ts";
import {
	type EditorPart,
	useEditorPartStore,
} from "../stores/useEditorPartStore.ts";
import type { Atom, AtomKind, AtomText, AtomToken } from "../types/atom.ts";
import type { EditorNode } from "../types/node.ts";

/**
 * Atoms: the runs of a plain text buffer that stand in for the parts a message
 * carries.
 *
 * A command, an attachment and a long paste all read badly in an input — a
 * directive is unreadable, and a pasted file is unusable — so the buffer holds
 * a short stand-in for each of them and the part itself is kept alongside, in
 * {@link useEditorPartStore}. {@link AtomUtils.serialize} puts the pointer back
 * before the message is sent, and {@link AtomUtils.deserialize} takes it back
 * out when a message is loaded for editing.
 */
export const AtomUtils = {
	/** Every atom currently standing in the input. */
	atoms: () => useAtomStore.getState().atoms,

	/**
	 * Take an atom into the registry and report the text that stands for it in
	 * the buffer.
	 *
	 * The same part always comes back as the same atom, and two atoms never
	 * share the text they stand as — otherwise one would be serialized as the
	 * other. Pass `content` to drop the atoms it no longer holds.
	 */
	register: ({
		content,
		kind,
		text,
		id,
	}: {
		content?: string;
		kind: AtomKind;
		text: AtomText;
		id: string;
	}): string => {
		const { setAtoms } = useAtomStore.getState();

		const atoms = AtomUtils.atoms().filter(
			(atom) => content === undefined || content.includes(atom.text),
		);

		const existing = atoms.find((atom) => atom.kind === kind && atom.id === id);
		if (existing) {
			setAtoms(atoms);
			return existing.text;
		}

		let unique = "";
		for (let index = 0; !unique; index++) {
			const candidate = text(index);
			if (!atoms.some((atom) => atom.text === candidate)) unique = candidate;
		}

		setAtoms([...atoms, { kind, text: unique, id }]);

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

	/** The buffer with every atom put back as the pointer it stands for. */
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

			const pointer = EditorPartUtils.toPointer({
				type: atom.kind,
				id: atom.id,
			});
			// A quote and a paste are block directives, which only parse on a line
			// of their own.
			return EditorPartUtils.isInline(atom.kind) ? pointer : `\n${pointer}\n`;
		});
	},

	/** Adapt a shared editor node to the short stand-in used by a plain buffer. */
	fromNode: ({ content, node }: { content: string; node: EditorNode }) => {
		const part = useEditorPartStore.getState().parts[node.id];
		if (part?.type !== node.type) return "";
		return AtomUtils.fromPart({ content, part });
	},

	/**
	 * The inverse of {@link AtomUtils.serialize}: a message's Markdown as a
	 * buffer, with every pointer in it taken back into an atom. Replaces the
	 * registry, since the atoms that were standing in the buffer this one takes
	 * over from are gone with it.
	 */
	deserialize: (markdown: string) => {
		useAtomStore.getState().setAtoms([]);

		return DirectiveUtils.extractFromMarkdown(markdown, ...EDITOR_PART_TYPES)
			.map(({ text, directive }) => {
				if (!directive) return text;

				const part =
					useEditorPartStore.getState().parts[directive.attributes.id];
				if (part?.type !== directive.tag) return text;

				return AtomUtils.fromPart({ part });
			})
			.join("");
	},

	/**
	 * The stand-in a part reads as in a plain buffer: an attachment as its name,
	 * a command as it was typed, a quote and a paste as what they hold.
	 */
	fromPart: ({
		content,
		part,
	}: {
		content?: string;
		part: EditorPart;
	}): string => {
		if (part.type === "attachment") {
			// An upload is mounted under its id, which reads as nothing at all, so
			// one carries a label and stands as that instead of as its path.
			const path = part.label
				? [part.label]
				: part.source.split(/[\\/]+/).filter(Boolean);
			const trailing = part.content.type === "directory" ? "/" : "";

			return AtomUtils.register({
				content,
				kind: "attachment",
				id: part.id,
				// Two files of the same name are told apart by as much of their
				// path as it takes.
				text: (index) => {
					if (index < path.length) {
						return `@${path.slice(path.length - index - 1).join("/")}${trailing}`;
					}
					return `@${PathUtils.name({ path })}${trailing} #${index - path.length + 2}`;
				},
			});
		}

		if (part.type === "command") {
			const written = `/${part.name}${part.argument ? ` ${part.argument}` : ""}`;
			return AtomUtils.register({
				content,
				kind: "command",
				id: part.id,
				text: (index) => (index ? `${written} #${index + 1}` : written),
			});
		}

		if (part.type === "quote") {
			const model = part.model ?? "message";
			return AtomUtils.register({
				content,
				kind: "quote",
				id: part.id,
				text: (index) =>
					index ? `[Quoted ${model} #${index + 1}]` : `[Quoted ${model}]`,
			});
		}

		const written = `[${part.lines} pasted lines]`;
		return AtomUtils.register({
			content,
			kind: "paste",
			id: part.id,
			text: (index) =>
				index ? `[${part.lines} pasted lines #${index + 1}]` : written,
		});
	},
} as const;
