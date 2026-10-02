/**
 * Worker entry for code highlighting. Each runtime bundles this as its own
 * worker (Vite `?worker` in the app, an extra Bun entrypoint in the CLI) and
 * hands it to `createClient({ highlighter })`.
 *
 * Requests run one at a time, newest-relevant first: a request cancelled
 * before it starts (a streaming block that has since grown, an unmounted
 * block) is dropped without being tokenized.
 */

import type {
	HighlightRequest,
	HighlightResponse,
} from "../utils/CodeUtils.ts";
import { HighlightService } from "./HighlightService.ts";

const scope = globalThis as unknown as {
	onmessage: ((event: { data: HighlightRequest }) => void) | null;
	postMessage: (message: HighlightResponse) => void;
};

const queue = new Map<
	number,
	Extract<HighlightRequest, { type: "highlight" }>
>();
const idle: Extract<HighlightRequest, { type: "prepare" }>[] = [];
let scheduled = false;

// A macrotask between jobs lets cancellations that arrived meanwhile land
// before the next job is picked.
const schedule = () => {
	if (scheduled) return;
	scheduled = true;
	setTimeout(drain, 0);
};

const drain = async () => {
	scheduled = false;

	const next = queue.values().next();
	if (!next.done) {
		const request = next.value;
		queue.delete(request.id);
		try {
			const result = await HighlightService.highlight(request);
			scope.postMessage({ type: "result", id: request.id, result });
		} catch (error) {
			scope.postMessage({
				type: "error",
				id: request.id,
				error: String(error),
			});
		}
	} else {
		// warm-up only runs when nothing visible is waiting
		const prepare = idle.shift();
		if (prepare) await HighlightService.prepare(prepare).catch(() => {});
	}

	if (queue.size > 0 || idle.length > 0) schedule();
};

scope.onmessage = ({ data }) => {
	switch (data.type) {
		case "highlight":
			queue.set(data.id, data);
			break;
		case "cancel":
			queue.delete(data.id);
			break;
		case "prepare":
			idle.push(data);
			break;
	}
	schedule();
};
