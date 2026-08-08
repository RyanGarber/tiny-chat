import type { ShellOutputChunk } from "@tiny-chat/core/src/features/capability/types/capability.ts";

/** Output a running tool has reported so far, split into attributed lines. */
interface ToolStreamLine {
	stream: ShellOutputChunk["stream"];
	value: string;
}

export interface ToolStreamState {
	lines: ToolStreamLine[];
	/** True once older lines have been dropped to stay within `MAX_LINES`. */
	truncated: boolean;
	/** Set when the tool has finished but the result has not been saved yet. */
	done: boolean;
}

/** Live output is a view, not a record: only the tail is worth keeping. */
const MAX_LINES = 500;
const MAX_LINE_LENGTH = 2_000;

/** Coalesce bursts of output into at most one render per frame-ish. */
const FLUSH_MS = 50;

/** Terminal control sequences would render as noise in either UI. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching escapes is the point
const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]|\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g;

interface Entry {
	/** Lines a newline has already closed. */
	lines: ToolStreamLine[];
	/** The line still being written to, shown but not yet closed. */
	partial: ToolStreamLine | null;
	truncated: boolean;
	done: boolean;
	snapshot: ToolStreamState;
	flush?: ReturnType<typeof setTimeout>;
}

const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

const EMPTY: ToolStreamState = Object.freeze({
	lines: Object.freeze([]) as unknown as ToolStreamLine[],
	truncated: false,
	done: false,
});

const notify = (key: string) => {
	const set = listeners.get(key);
	if (!set) return;
	for (const listener of [...set]) listener();
};

const publish = (key: string, entry: Entry) => {
	if (entry.flush) {
		clearTimeout(entry.flush);
		entry.flush = undefined;
	}
	entry.snapshot = {
		lines: entry.partial?.value
			? [...entry.lines, { ...entry.partial }]
			: [...entry.lines],
		truncated: entry.truncated,
		done: entry.done,
	};
	notify(key);
};

const schedule = (key: string, entry: Entry) => {
	if (entry.flush) return;
	entry.flush = setTimeout(() => {
		entry.flush = undefined;
		// The entry may have been cleared while the flush was pending.
		if (entries.get(key) !== entry) return;
		publish(key, entry);
	}, FLUSH_MS);
};

const append = (entry: Entry, chunk: ShellOutputChunk) => {
	const text = chunk.value.replace(ANSI, "").replace(/\r\n/g, "\n");
	if (!text) return;

	// Output arriving on the other stream closes whatever was open, so the two
	// interleave the way they would in a terminal.
	if (entry.partial && entry.partial.stream !== chunk.stream) {
		if (entry.partial.value) entry.lines.push(entry.partial);
		entry.partial = null;
	}

	let current: ToolStreamLine = entry.partial ?? {
		stream: chunk.stream,
		value: "",
	};

	const pieces = text.split("\n");
	pieces.forEach((piece, index) => {
		if (index > 0) {
			entry.lines.push(current);
			current = { stream: chunk.stream, value: "" };
		}

		// A carriage return rewrites the line it is on, which is how progress
		// bars and spinners report themselves.
		const rewrite = piece.lastIndexOf("\r");
		current.value = (
			rewrite >= 0 ? piece.slice(rewrite + 1) : current.value + piece
		).slice(0, MAX_LINE_LENGTH);
	});

	entry.partial = current;

	if (entry.lines.length > MAX_LINES) {
		entry.lines.splice(0, entry.lines.length - MAX_LINES);
		entry.truncated = true;
	}
};

/**
 * Holds the output of tools that are still running, keyed by the tool call they
 * belong to. Nothing here is persisted: once a call's result is saved the entry
 * is dropped and the saved result becomes the thing on screen.
 */
export const ToolStreamService = {
	key: ({ messageId, partId }: { messageId: string; partId: string }) =>
		`${messageId}:${partId}`,

	/** Begin (or restart) collecting output for a call. */
	start: (key: string) => {
		const previous = entries.get(key);
		if (previous?.flush) clearTimeout(previous.flush);

		const entry: Entry = {
			lines: [],
			partial: null,
			truncated: false,
			done: false,
			snapshot: EMPTY,
		};
		entries.set(key, entry);
		notify(key);
	},

	push: (key: string, chunk: ShellOutputChunk) => {
		const entry = entries.get(key);
		if (!entry) return;

		append(entry, chunk);
		schedule(key, entry);
	},

	/** Mark the call as finished while its result is being saved. */
	finish: (key: string) => {
		const entry = entries.get(key);
		if (!entry) return;

		entry.done = true;
		publish(key, entry);
	},

	clear: (key: string) => {
		const entry = entries.get(key);
		if (!entry) return;

		if (entry.flush) clearTimeout(entry.flush);
		entries.delete(key);
		notify(key);
	},

	get: (key: string): ToolStreamState | undefined => entries.get(key)?.snapshot,

	subscribe: (key: string, listener: () => void) => {
		const set = listeners.get(key) ?? new Set();
		set.add(listener);
		listeners.set(key, set);
		return () => {
			set.delete(listener);
			if (!set.size) listeners.delete(key);
		};
	},

	/** Helper for debug/tests. */
	getSubscriberCount: (key: string) => listeners.get(key)?.size ?? 0,
} as const;
