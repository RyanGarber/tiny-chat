import type { MessageState } from "@tiny-chat/shared/src/features/data/types/message.ts";

const streams = new Map<string, Stream>();
const listeners = new Set<() => void>();
let idsSnapshot: readonly string[] = Object.freeze([]);

const notify = () => {
	for (const listener of [...listeners]) listener();
};

export const StreamService = {
	/** Subscribe to changes in the set of active streaming IDs. */
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},

	/** Stable array reference for useSyncExternalStore. */
	getIds: () => idsSnapshot,

	get: (id: string) => streams.get(id),

	has: (id: string) => streams.has(id),

	getChat: (chatId: string) => {
		for (const stream of streams.values()) {
			if (stream.message.chatId === chatId) return stream;
		}
		return undefined;
	},

	start: (message: MessageState) => {
		// Abort existing to prevent race conditions (Rust-style safety)
		streams.get(message.id)?.abort.abort();

		const stream = toStream(message);
		streams.set(stream.id, stream);

		// Update immutable snapshot
		idsSnapshot = Object.freeze([...streams.keys()]);
		notify();
		return stream;
	},

	stop: (id: string) => {
		const stream = streams.get(id);
		if (!stream) return;

		streams.delete(id);
		idsSnapshot = Object.freeze([...streams.keys()]);

		// Final notification for stream consumers
		stream.apply();
		notify();
	},

	abortAll: () => {
		for (const stream of streams.values()) {
			stream.abort.abort();
		}
	},

	// Helper for debug/tests
	getRegistrySubscriberCount: () => listeners.size,
} as const;

/** A live stream handle for a single message. */
export interface Stream {
	readonly id: string;
	readonly abort: AbortController;
	message: MessageState;
	subscribe: (listener: () => void) => () => void;
	getVersion: () => number;
	apply: (mutate?: (m: MessageState) => void) => void;
	replace: (message: MessageState) => void;
	getSubscriberCount: () => number;
}

function toStream(initialMessage: MessageState): Stream {
	let version = 0;
	const listeners = new Set<() => void>();
	const abort = new AbortController();

	const notify = () => {
		for (const listener of [...listeners]) listener();
	};

	return {
		id: initialMessage.id,
		abort,
		message: initialMessage,

		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		getVersion: () => version,

		apply(mutate) {
			if (mutate) mutate(this.message);
			version++;
			notify();
		},

		replace(newMessage) {
			this.message = newMessage;
			this.apply();
		},

		getSubscriberCount: () => listeners.size,
	};
}
