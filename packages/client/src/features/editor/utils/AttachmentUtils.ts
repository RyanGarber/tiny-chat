import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type {
	AttachmentGroup,
	AttachmentItem,
	AttachmentQuery,
} from "../types/attachment.ts";
import type { CommandEdit } from "../types/command.ts";
import { AtomUtils } from "./AtomUtils.ts";
import { CommandUtils } from "./CommandUtils.ts";

/** `@path`, at the end of a line */
const QUERY_REGEX = /(?:^|\s)@(\S*)$/;

export const AttachmentUtils = {
	/**
	 * Locate the attachment being typed at `cursor` in a plain text buffer.
	 */
	query: ({
		content,
		cursor,
	}: {
		content: string;
		cursor?: [row: number, column: number];
	}): AttachmentQuery | null => {
		if (!cursor) return null;

		const [row, column] = cursor;
		// Read against the buffer with its atoms blanked out, so an attachment
		// already written into one is not taken for a path still being typed.
		const lines = AtomUtils.mask({
			content,
			atoms: AtomUtils.atoms(),
		}).split("\n");
		const line = lines[row];
		if (line === undefined) return null;

		const match = QUERY_REGEX.exec(line.slice(0, column));
		if (!match) return null;

		const [raw, text] = match;
		const offset = lines
			.slice(0, row)
			.reduce((total, line) => total + line.length + 1, 0);
		const from = offset + match.index + raw.indexOf("@");
		const to = offset + column;

		return { text: content.slice(to - text.length, to), from, to };
	},

	/**
	 * Narrow attachment groups to those matching `query`, given the last path
	 * segment being typed. Paths that traverse into a directory only include
	 * items that can be traversed into further.
	 */
	filter: ({
		groups,
		query = "",
	}: {
		groups: AttachmentGroup[];
		query?: string;
	}): AttachmentGroup[] => {
		const search = query.split("/").at(-1)?.trim().toLowerCase();
		const traversing = query.includes("/");

		return groups
			.map((group) => ({
				...group,
				items: group.items.filter(
					(item) =>
						(!search || item.name?.toLowerCase().includes(search)) &&
						(!traversing || item.traversable),
				),
			}))
			.filter((group) => group.items.length > 0);
	},

	/**
	 * An attachment directive, which is how an attachment travels with the
	 * message it was written in.
	 */
	toDirective: ({ item }: { item: AttachmentItem }) => {
		const attributes = CommonUtils.toAttributesString({
			source: item.value,
			"is-directory": item.directory ? "true" : "false",
			...(item.label ? { name: item.label } : {}),
		});

		return `:attachment[]{${attributes}}`;
	},

	/**
	 * An upload as an attachment: its own directory on the mount, under the name
	 * it was uploaded or cloned as. Attaching it is what pulls it into the
	 * message — there is nothing else holding it there.
	 */
	forUpload: ({
		upload,
	}: {
		upload: { id: string; name: string };
	}): AttachmentItem => ({
		name: upload.name,
		// A directive's attributes are read back out of a quoted, braced run, so
		// a name carrying either of those would cut the directive short.
		label: upload.name.replace(/["}]/g, ""),
		value: PathUtils.toMount({ mount: "uploads", id: upload.id }),
		// An upload stands on its own, so it can be walked into whether or not
		// anything points at it yet — under its id, which is where it lives.
		path: ["uploads", upload.id].join("/"),
		directory: true,
		traversable: true,
	}),

	/**
	 * Write the chosen attachment into a plain text buffer as an atom standing
	 * for its directive, which is the file's name alone.
	 */
	apply: ({
		content,
		query,
		item,
	}: {
		content: string;
		query: AttachmentQuery;
		item: AttachmentItem;
	}): CommandEdit => {
		const text = AtomUtils.attachment({
			content,
			source: item.value,
			directory: item.directory,
			label: item.label,
			markdown: AttachmentUtils.toDirective({ item }),
		});

		return CommandUtils.edit({
			content,
			from: query.from,
			to: query.to,
			text: `${text} `,
		});
	},

	/**
	 * What the query becomes on traversing into `item` — the one rule for it,
	 * since every editor has its own way of putting the text back and only this
	 * part is the same between them.
	 *
	 * An item that knows its own path says where it is outright; anything else
	 * is named by what it is called, one segment at a time.
	 */
	continued: ({ query, item }: { query: string; item: AttachmentItem }) => {
		const trailing = item.directory ? "/" : "";

		return item.path
			? `${item.path}${trailing}`
			: query.replace(/([^/]+)?$/, `${item.name}${trailing}`);
	},

	/**
	 * Continue traversing into the chosen item, replacing the last path
	 * segment being typed rather than finalizing an attachment.
	 */
	complete: ({
		content,
		query,
		item,
	}: {
		content: string;
		query: AttachmentQuery;
		item: AttachmentItem;
	}): CommandEdit => {
		return CommandUtils.edit({
			content,
			from: query.from,
			to: query.to,
			text: `@${AttachmentUtils.continued({ query: query.text, item })}`,
		});
	},
} as const;
