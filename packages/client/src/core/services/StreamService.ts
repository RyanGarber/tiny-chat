import type {
	Stream,
	StreamMutation,
	StreamOptions,
	StreamState,
} from "@tiny-chat/core/src/core/types/stream.ts";
import type { zData } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { ToolDefinition } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import type { z } from "zod";
import { useStreamStore } from "../../features/agent/stores/useStreamStore.ts";

// ── Module-level state ────────────────────────────────────────────────────────

const MAX_ITEMS_DEFAULT = 500;
const FLUSH_MS = 50;

const streams = new Map<string, Stream<any>>();
const listeners = new Map<string, Set<() => void>>();

// ── Helpers ───────────────────────────────────────────────────────────────────

const publish = <T>(stream: Stream<T>) => {
	const items = stream.keep
		? stream.items.filter(stream.keep)
		: [...stream.items];
	stream.snapshot = { items, truncated: stream.truncated };
};

const notify = (key: string) => {
	const set = listeners.get(key);
	if (!set) return;
	for (const listener of [...set]) listener();
};

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * A thin, framework-agnostic pub/sub store for in-flight stream data.
 *
 * Replaces `AgentStreamService` and `ToolStreamService`. Both used unique keys
 * and the same flush/snapshot/notify loop; the only behavioural difference was
 * whether a new value *appended* to a list or *replaced* the current tail.
 * That distinction is now a `mode` field on every {@link StreamMutation}.
 *
 * The former `stage`/`staged` machinery from `ToolStreamService` is gone:
 * callers own any line-coalescing or mutation logic and simply alternate between
 * `mode: "replace"` (mutate the tail) and `mode: "append"` (commit and start
 * the next item).
 *
 * The `chat` parameter that `AgentStreamService` required on `clear` and `abort`
 * is now stored at `start` time and applied automatically.
 */
export class StreamService<T> {
	// ── Read ──────────────────────────────────────────────────────────────────

	get(key: string): StreamState<T> | undefined {
		return streams.get(key)?.snapshot as StreamState<T> | undefined;
	}

	subscribe(key: string, listener: () => void): () => void {
		const set = listeners.get(key) ?? new Set();
		set.add(listener);
		listeners.set(key, set);
		return () => {
			set.delete(listener);
			if (!set.size) listeners.delete(key);
		};
	}

	/** Exposed for debugging and tests. */
	getSubscriberCount(key: string): number {
		return listeners.get(key)?.size ?? 0;
	}

	// ── Write ─────────────────────────────────────────────────────────────────

	start(key: string, options: StreamOptions<T> = {}): AbortController {
		const previous = streams.get(key);
		if (previous?.flush) clearTimeout(previous.flush);

		const items: T[] = options.initial !== undefined ? [options.initial] : [];

		const stream: Stream<T> = {
			items,
			truncated: false,
			snapshot: { items: [...items], truncated: false },
			abort: new AbortController(),
			chat: options.chat,
			keep: options.keep,
			maxItems: options.maxItems ?? MAX_ITEMS_DEFAULT,
		};

		streams.set(key, stream);
		notify(key);

		if (options.chat) {
			console.log(`SETCHATAGENTSTREAM(${options.chat}: ${key})`);
			useStreamStore.getState().setChatAgentStream(options.chat, key);
		}

		return stream.abort;
	}

	mutate(key: string, mutation: StreamMutation<T>): void {
		const stream = streams.get(key) as Stream<T> | undefined;
		if (!stream) return;

		if (mutation.options) Object.assign(stream, mutation.options);

		if (mutation.mode === "patch") {
			if (!stream.items.length) throw new Error("stream has nothing to patch");
			stream.items[stream.items.length - 1] = {
				...stream.items[stream.items.length - 1],
				...mutation.data,
			};
		} else if (mutation.mode === "replace" && stream.items.length > 0) {
			stream.items[stream.items.length - 1] = mutation.data;
		} else {
			stream.items.push(mutation.data);
		}

		if (stream.items.length > stream.maxItems) {
			stream.items.splice(0, stream.items.length - stream.maxItems);
			stream.truncated = true;
		}

		this.#schedule(key, stream);
	}

	#schedule(key: string, stream: Stream<T>): void {
		if (stream.flush) return;

		stream.flush = setTimeout(() => {
			stream.flush = undefined;
			if (streams.get(key) !== stream) return;
			publish(stream);
			notify(key);
		}, FLUSH_MS);
	}

	clear(key: string): void {
		const stream = streams.get(key);
		if (!stream) return;

		if (stream.flush) clearTimeout(stream.flush);

		const { chat } = stream;
		streams.delete(key);
		notify(key);

		if (chat) {
			useStreamStore.getState().setChatAgentStream(chat, null);
		}
	}

	abort(key: string): void {
		const stream = streams.get(key);
		if (!stream) return;

		stream.abort.abort();

		setTimeout(() => {
			if (streams.get(key)) {
				console.warn("[StreamService] stream was not cleared after abort");
				this.clear(key);
			}
		}, 5000);
	}

	of<U extends T>(): StreamService<U> {
		return this as unknown as StreamService<U>;
	}
}

export const GenericStreamService = new StreamService();

export type AgentStreamEvent = {
	data: zData;
	status?: "pending" | "thinking" | "generating";
};
export const AgentStreamService = GenericStreamService.of<AgentStreamEvent>();

export type ToolStreamEvent<T extends ToolDefinition> = z.infer<T["stream"]>;
export const ToolStreamService =
	GenericStreamService.of<ToolStreamEvent<any>>();
