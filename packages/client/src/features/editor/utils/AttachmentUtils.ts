import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type {
	AttachmentGroup,
	AttachmentItem,
	AttachmentQuery,
} from "../types/attachment.ts";
import type { CommandEdit } from "../types/command.ts";
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
		const lines = content.split("\n");
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

		return { text, from, to };
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
	 * Write the chosen attachment into a plain text buffer as a directive.
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
		const attributes = CommonUtils.toAttributesString({
			source: item.value,
			"is-directory": item.directory ? "true" : "false",
		});

		return CommandUtils.edit({
			content,
			from: query.from,
			to: query.to,
			text: `:attachment[]{${attributes}} `,
		});
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
		const name = `${item.name}${item.directory ? "/" : ""}`;

		return CommandUtils.edit({
			content,
			from: query.from,
			to: query.to,
			text: `@${query.text.replace(/([^/]+)?$/, name)}`,
		});
	},
} as const;
