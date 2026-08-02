export interface CompletionItem {
	name?: string;
	value: string;
	active?: boolean;
}

export interface CompletionGroup<T extends CompletionItem = CompletionItem> {
	name?: string;
	items: T[];
}

export interface CommandChoiceItem extends CompletionItem {
	run?: (command: CommandItem) => unknown;
}

export interface CommandChoiceGroup
	extends CompletionGroup<CommandChoiceItem> {}

export interface CommandItem extends CompletionItem {
	choices?: CommandChoiceGroup[];
	dynamic?: boolean;
	run?: (value?: string) => unknown;
}

export interface CommandGroup extends CompletionGroup<CommandItem> {
	max?: number;
}

/**
 * A command being typed in a plain text buffer, up to the cursor.
 */
export interface CommandQuery {
	/** the command the argument belongs to, once its name has been typed */
	command: CommandItem | null;
	/** the text being completed: a command name, or an argument */
	text: string;
	/** offset of the leading slash */
	from: number;
	/** offset of `text`, which always ends at the cursor */
	textFrom: number;
	/** offset of the cursor */
	to: number;
}

/**
 * A plain text buffer and cursor position after applying a command.
 */
export interface CommandEdit {
	content: string;
	cursor: [row: number, column: number];
}
