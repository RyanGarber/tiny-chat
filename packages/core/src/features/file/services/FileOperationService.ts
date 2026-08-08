import fuzzysort from "fuzzysort";
import type { ShellCapability } from "../../capability/types/capability.ts";
import { type FileEditResult, FileEditUtils } from "../utils/FileEditUtils.ts";
import { FileUtils } from "../utils/FileUtils.ts";
import { PathUtils } from "../utils/PathUtils.ts";
import { FileSearchService } from "./FileSearchService.ts";

/** Lines a single `readText` call returns when the caller does not say. */
const DEFAULT_LINE_LIMIT = 1_000;

/** Characters a single `readText` call returns, whatever the line limit says. */
const MAX_READ_CHARS = 120_000;

/** Characters of any one line that are returned before it is cut. */
const MAX_LINE_CHARS = 2_000;

/** Lines of context shown around an applied edit. */
const EDIT_CONTEXT_LINES = 3;

export interface FileReadResult {
	path: string;
	text: string;
	/** 1-based line the excerpt starts at. */
	offset: number;
	/** Lines returned. */
	lines: number;
	/** Lines in the whole file. */
	total: number;
	truncated: boolean;
	/** Present when the file was cut short, explaining how to read the rest. */
	notice?: string;
}

export const FileOperationService = {
	walk: async ({
		shell,
		path,
		includeDirectories = false,
	}: {
		shell: Pick<ShellCapability, "readDir"> &
			Partial<Pick<ShellCapability, "readFile">>;
		path: string;
		includeDirectories?: boolean;
	}): Promise<{ path: string; is_dir: boolean }[]> => {
		const { entries } = await FileSearchService.walk({
			shell,
			path,
			includeDirectories,
		});
		return entries;
	},

	/**
	 * Reads a window of a text file. Unbounded reads are the easiest way for an
	 * agent to lose its context to a single file, so every read is capped by
	 * lines, by characters and by line length, and says so when it cuts.
	 */
	readText: async ({
		shell,
		path,
		offset,
		limit,
	}: {
		shell: Pick<ShellCapability, "readFile">;
		path: string;
		offset?: number;
		limit?: number;
	}): Promise<FileReadResult> => {
		const file = await shell.readFile({ path });
		const content = FileUtils.getTextFromBytes(file);
		if (content === null)
			throw new Error(`Cannot read file as text: ${file.path}`);

		return FileOperationService.getTextWindow({
			path: file.path,
			content,
			offset,
			limit,
		});
	},

	/**
	 * The windowing half of {@link readText}, over content already in hand.
	 */
	getTextWindow: ({
		path,
		content,
		offset = 1,
		limit = DEFAULT_LINE_LIMIT,
	}: {
		path: string;
		content: string;
		offset?: number;
		limit?: number;
	}): FileReadResult => {
		const all = content.split("\n");
		const start = Math.max(1, Math.floor(offset));
		const end = Math.min(
			all.length,
			start + Math.max(1, Math.floor(limit)) - 1,
		);

		if (start > all.length && all.length > 0) {
			throw new Error(
				`Offset ${start} is past the end of ${path}, which has ${all.length} line(s).`,
			);
		}

		const selected: string[] = [];
		let characters = 0;
		let cut = false;

		for (let index = start; index <= end; index++) {
			const line = all[index - 1] ?? "";
			const trimmed =
				line.length > MAX_LINE_CHARS
					? `${line.slice(0, MAX_LINE_CHARS)}… [${line.length - MAX_LINE_CHARS} more characters on this line]`
					: line;
			if (characters + trimmed.length > MAX_READ_CHARS) {
				cut = true;
				break;
			}
			selected.push(trimmed);
			characters += trimmed.length + 1;
		}

		const last = start + selected.length - 1;
		const truncated = cut || last < all.length || start > 1;

		return {
			path,
			text: selected.join("\n"),
			offset: start,
			lines: selected.length,
			total: all.length,
			truncated,
			notice: truncated
				? `Showing lines ${start}-${last} of ${all.length}. Read further with offset ${last + 1}, or use grep_files to jump to what you need.`
				: undefined,
		};
	},

	/**
	 * Fuzzy file-name lookup, for pickers and for locating a file whose exact
	 * spelling is unknown. Never reads file contents.
	 */
	searchNames: async ({
		shell,
		path,
		query,
		maxResults = 10,
	}: {
		shell: Pick<ShellCapability, "readDir"> &
			Partial<Pick<ShellCapability, "readFile">>;
		path: string;
		query: string;
		maxResults?: number;
	}): Promise<{ path: string; is_dir: boolean }[]> => {
		const normalizedQuery = query.trim();
		if (!normalizedQuery) throw new Error("Search query must not be empty.");

		const { entries } = await FileSearchService.walk({
			shell,
			path,
			includeDirectories: true,
		});

		const targets = entries.map((entry) => ({
			entry,
			name: PathUtils.name(entry),
			path: PathUtils.normalize({ path: entry.path, unix: true }),
		}));

		const matches = fuzzysort.go(normalizedQuery, targets, {
			keys: ["name", "path"],
			limit: maxResults,
			// The name is what the user typed at; the path only breaks ties.
			scoreFn: (result) =>
				Math.max(result[0]?.score ?? 0, (result[1]?.score ?? 0) * 0.5),
		});

		return matches.map(({ obj }) => obj.entry);
	},

	searchFiles: async ({
		shell,
		path,
		query,
		include,
		maxResults = 10,
	}: {
		shell: Pick<ShellCapability, "readDir" | "readFile">;
		path: string;
		query: string;
		include?: string;
		maxResults?: number;
	}) =>
		await FileSearchService.search({
			shell,
			path,
			query,
			include,
			maxResults,
		}),

	grepFiles: async ({
		shell,
		path,
		query,
		literal,
		caseSensitive,
		include,
		context,
		maxResults = 10,
	}: {
		shell: Pick<ShellCapability, "readDir" | "readFile">;
		path: string;
		query: string;
		literal?: boolean;
		caseSensitive?: boolean;
		include?: string;
		context?: number;
		maxResults?: number;
	}) =>
		await FileSearchService.grep({
			shell,
			path,
			query,
			literal,
			caseSensitive,
			include,
			context,
			maxResults,
		}),

	/**
	 * Resolves an edit against the file on disk without writing it, so a call
	 * that could never land can be rejected before it is applied or approved.
	 * Throws the same explanations `editFile` would.
	 */
	resolveEdit: async ({
		shell,
		path,
		old_string,
		new_string,
		replace_all,
	}: {
		shell: Pick<ShellCapability, "readFile">;
		path: string;
		old_string: string;
		new_string: string;
		replace_all?: boolean;
	}): Promise<{ path: string; edit: FileEditResult }> => {
		const file = await shell.readFile({ path });
		const content = FileUtils.getTextFromBytes(file);
		if (content === null)
			throw new Error(`Cannot read file as text: ${file.path}`);

		return {
			path: file.path,
			edit: FileEditUtils.apply({
				content,
				old_string,
				new_string,
				replace_all,
			}),
		};
	},

	editFile: async ({
		shell,
		path,
		old_string,
		new_string,
		replace_all,
	}: {
		shell: Pick<ShellCapability, "readFile" | "writeFile">;
		path: string;
		old_string: string;
		new_string: string;
		replace_all?: boolean;
	}) => {
		const { path: resolved, edit } = await FileOperationService.resolveEdit({
			shell,
			path,
			old_string,
			new_string,
			replace_all,
		});
		const written = await shell.writeFile({
			path: resolved,
			content: edit.content,
		});

		return {
			path: written.path,
			success: true as const,
			replacements: edit.replacements,
			/** Where the first replacement landed, so the edit can be verified. */
			preview: FileOperationService.getEditPreview({
				content: edit.content,
				new_string,
			}),
		};
	},

	/**
	 * The edited region with a few lines of context, numbered. Cheap for the
	 * model to check, and it removes the reflex to re-read the whole file.
	 */
	getEditPreview: ({
		content,
		new_string,
	}: {
		content: string;
		new_string: string;
	}): string => {
		const index = new_string.length ? content.indexOf(new_string) : -1;
		const lines = content.split("\n");

		const target =
			index === -1 ? 1 : content.slice(0, index).split("\n").length;
		const added = new_string.length ? new_string.split("\n").length : 1;

		const start = Math.max(1, target - EDIT_CONTEXT_LINES);
		const end = Math.min(lines.length, target + added - 1 + EDIT_CONTEXT_LINES);

		return lines
			.slice(start - 1, end)
			.map((line, offset) => {
				const number = start + offset;
				const text =
					line.length > 200
						? `${line.slice(0, 200)}…`
						: line.replace(/\s+$/, "");
				return text ? `${number}: ${text}` : `${number}:`;
			})
			.join("\n");
	},
} as const;
