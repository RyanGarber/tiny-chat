// ── Public types ──────────────────────────────────────────────────────────────

export interface StreamState<T> {
	items: T[];
	truncated: boolean;
}

/**
 * "append"  — push a new item onto the end of the list.
 * "replace" — overwrite the last item in-place (or push if the list is empty).
 *
 * Use "replace" to coalesce a burst of updates into a single mutable item
 * (e.g. the current line of shell output), then switch to "append" when you
 * are ready to commit that item and begin the next one.
 */
export type StreamMutation<T> = { options?: Partial<StreamOptions<T>> } & (
	| {
			mode: "append" | "replace";
			data: T;
	  }
	| {
			mode: "patch";
			data: Partial<T>;
	  }
);

export interface StreamOptions<T> {
	/** Seed the stream with a single item instead of starting empty. */
	initial?: T;
	/**
	 * Chat ID — when provided the stream registers / de-registers itself in
	 * `useStreamStore` so the UI can tie a running stream to a conversation.
	 */
	chat?: string | null;
	/**
	 * Return false to exclude an item from the published snapshot.
	 * Items that fail the filter are still held in the live buffer so they can
	 * influence later decisions; they simply do not reach consumers.
	 */
	keep?: (item: T) => boolean;
	/** Maximum items to retain; older items are dropped from the head (default 500). */
	maxItems?: number;
}

// ── Internal types ────────────────────────────────────────────────────────────

export interface Stream<T> extends StreamState<T> {
	snapshot: StreamState<T>;
	abort: AbortController;
	flush?: ReturnType<typeof setTimeout>;
	chat?: string | null;
	keep?: (item: T) => boolean;
	maxItems: number;
}
