import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type {
	CommandChoiceGroup,
	CommandChoiceItem,
	CommandEdit,
	CommandGroup,
	CommandItem,
	CommandQuery,
} from "../types/command.ts";

/** `/name` optionally followed by an argument, at the end of a line */
const QUERY_REGEX = /(?:^|\s)\/(\S*)(?:[ \t]+([^\n]*))?$/;

export const CommandUtils = {
	/**
	 * Whether a command carries its argument as content, either one of its
	 * choices or free text.
	 */
	acceptsContent: (command: CommandItem) =>
		!!command.choices || !!command.dynamic,

	/**
	 * Whether a command acts on the client rather than travelling with the
	 * message it was written in.
	 */
	needsRun: (command: CommandItem) =>
		!!command.run ||
		!!command.choices
			?.flatMap((group) => group.items)
			.some((item) => !!item.run),

	find: ({ groups, name }: { groups: CommandGroup[]; name?: string }) =>
		groups.flatMap((group) => group.items).find((item) => item.name === name) ??
		null,

	findChoice: ({ command, name }: { command: CommandItem; name?: string }) =>
		command.choices
			?.flatMap((group) => group.items)
			.find((item) => item.name === name) ?? null,

	/**
	 * Narrow commands to those matching `query` that are still available, given
	 * the values already used and each group's maximum.
	 */
	filter: ({
		groups,
		query = "",
		used = [],
	}: {
		groups: CommandGroup[];
		query?: string;
		used?: string[];
	}): CommandGroup[] => {
		const items = groups.flatMap((group) => group.items);

		const include = (item: CommandItem, group: CommandGroup) => {
			const usedInGroup = used.filter((value) =>
				group.items.some((item) => item.value === value),
			);
			return (
				items.filter((other) => other.value === item.value).length === 1 &&
				!used.includes(item.value) &&
				(!group.max || usedInGroup.length < group.max) &&
				!!item.name?.toLowerCase().includes(query.toLowerCase())
			);
		};

		return groups
			.map((group) => ({
				...group,
				items: group.items.filter((item) => include(item, group)),
			}))
			.filter((group) => group.items.length > 0);
	},

	filterChoices: ({
		command,
		query = "",
	}: {
		command: CommandItem | null;
		query?: string;
	}): CommandChoiceGroup[] =>
		(command?.choices ?? [])
			.map((group) => ({
				...group,
				items: group.items.filter(
					(item) => !!item.name?.toLowerCase().includes(query.toLowerCase()),
				),
			}))
			.filter((group) => group.items.length > 0),

	/**
	 * Run a command with the value written for it, which may name one of its
	 * choices. Returns false when there was nothing to run.
	 */
	run: ({ command, value }: { command: CommandItem; value?: string }) => {
		if (!CommandUtils.acceptsContent(command)) {
			if (!command.run) return false;
			command.run();
			return true;
		}

		const choice = CommandUtils.findChoice({ command, name: value });
		if (choice) return CommandUtils.runChoice({ command, choice });

		if (!command.dynamic || !command.run) return false;
		command.run(value);
		return true;
	},

	/**
	 * Run a command against one of its choices. Returns false when neither the
	 * command nor the choice has anything to run.
	 */
	runChoice: ({
		command,
		choice,
	}: {
		command: CommandItem;
		choice: CommandChoiceItem;
	}) => {
		if (!command.run && !choice.run) return false;
		command.run?.(choice.name);
		choice.run?.(command);
		return true;
	},

	/**
	 * Locate the command being typed at `cursor` in a plain text buffer.
	 */
	query: ({
		content,
		cursor,
		groups,
	}: {
		content: string;
		cursor?: [row: number, column: number];
		groups: CommandGroup[];
	}): CommandQuery | null => {
		if (!cursor) return null;

		const [row, column] = cursor;
		const lines = content.split("\n");
		const line = lines[row];
		if (line === undefined) return null;

		const match = QUERY_REGEX.exec(line.slice(0, column));
		if (!match) return null;

		const [raw, name, argument] = match;
		const offset = lines
			.slice(0, row)
			.reduce((total, line) => total + line.length + 1, 0);
		const from = offset + match.index + raw.indexOf("/");
		const to = offset + column;

		if (argument === undefined) {
			return {
				command: null,
				text: name,
				from,
				textFrom: to - name.length,
				to,
			};
		}

		const command = CommandUtils.find({ groups, name });
		if (!command || !CommandUtils.acceptsContent(command)) return null;

		return {
			command,
			text: argument,
			from,
			textFrom: to - argument.length,
			to,
		};
	},

	/**
	 * Replace a range of a plain text buffer, reporting where the cursor lands.
	 */
	edit: ({
		content,
		from,
		to,
		text,
	}: {
		content: string;
		from: number;
		to: number;
		text: string;
	}): CommandEdit => {
		const updated = content.slice(0, from) + text + content.slice(to);
		const lines = updated.slice(0, from + text.length).split("\n");
		return {
			content: updated,
			cursor: [lines.length - 1, lines[lines.length - 1].length],
		};
	},

	/**
	 * A command directive, used for commands that are read from the message
	 * they were written in instead of being run.
	 */
	toDirective: ({
		command,
		value,
	}: {
		command: CommandItem;
		value?: string;
	}) => {
		const attributes = CommonUtils.toAttributesString({
			name: command.name,
			value: command.value,
		});
		return `:command[${value ?? ""}]{${attributes}}`;
	},

	/**
	 * Write a chosen command into a plain text buffer: run it, wait for its
	 * argument, or leave it for the message. Pass `complete` to only write out
	 * the command's name.
	 */
	applyCommand: ({
		content,
		query,
		command,
		complete,
	}: {
		content: string;
		query: CommandQuery;
		command: CommandItem;
		complete?: boolean;
	}): CommandEdit => {
		const { from, to } = query;

		if (CommandUtils.acceptsContent(command)) {
			return CommandUtils.edit({
				content,
				from,
				to,
				text: `/${command.name} `,
			});
		}

		if (complete) {
			return CommandUtils.edit({ content, from, to, text: `/${command.name}` });
		}

		if (CommandUtils.run({ command })) {
			return CommandUtils.edit({ content, from, to, text: "" });
		}

		return CommandUtils.edit({
			content,
			from,
			to,
			text: CommandUtils.toDirective({ command }),
		});
	},

	/**
	 * Write a chosen choice into a plain text buffer. Pass `complete` to only
	 * write out the choice's name.
	 */
	applyChoice: ({
		content,
		query,
		choice,
		complete,
	}: {
		content: string;
		query: CommandQuery;
		choice: CommandChoiceItem;
		complete?: boolean;
	}): CommandEdit | null => {
		const { command, from, to } = query;
		if (!command) return null;

		if (complete) {
			return CommandUtils.edit({
				content,
				from,
				to,
				text: `/${command.name} ${choice.name}`,
			});
		}

		if (CommandUtils.runChoice({ command, choice })) {
			return CommandUtils.edit({ content, from, to, text: "" });
		}

		return CommandUtils.edit({
			content,
			from,
			to,
			text: CommandUtils.toDirective({ command, value: choice.name }),
		});
	},

	/**
	 * Write the argument typed for a command into a plain text buffer, for
	 * commands that take free text or when there is nothing left to choose.
	 */
	applyContent: ({
		content,
		query,
	}: {
		content: string;
		query: CommandQuery;
	}): CommandEdit | null => {
		const { command, from, to, text } = query;
		if (!command) return null;

		const value = text.trim();

		if (CommandUtils.run({ command, value })) {
			return CommandUtils.edit({ content, from, to, text: "" });
		}

		if (!value || CommandUtils.needsRun(command)) return null;

		return CommandUtils.edit({
			content,
			from,
			to,
			text: CommandUtils.toDirective({ command, value }),
		});
	},
} as const;
