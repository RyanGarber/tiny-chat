import type { zToolCallPart } from "@tiny-chat/core/features/data/types/part.ts";
import type { ToolFeedback } from "@tiny-chat/core/features/tool/types/tool.ts";
import { useToolFeedbackStore } from "../stores/useToolFeedbackStore.ts";

/** Resolvers of the answers live generations are waiting on, by call id. */
const waiters = new Map<string, (answer: ToolFeedback) => void>();
/** Answers given ahead of the generation that will ask for them. */
const answers = new Map<string, ToolFeedback>();

/**
 * Hands the user's answers to tool calls to the generation that runs them.
 * A generation still running when the user answers takes the answer at once;
 * otherwise it is held for the generation the answer resumes.
 */
export const ToolFeedbackService = {
	/** The generation's side: resolves with the call's answer once given. */
	wait: ({
		part,
		signal,
	}: {
		part: zToolCallPart;
		signal: AbortSignal;
	}): Promise<ToolFeedback> => {
		const given = answers.get(part.id);
		if (given) {
			answers.delete(part.id);
			return Promise.resolve(given);
		}
		if (signal.aborted) return Promise.reject(signal.reason);
		return new Promise((resolve, reject) => {
			const settle = (answer: ToolFeedback) => {
				signal.removeEventListener("abort", onAbort);
				resolve(answer);
			};
			const onAbort = () => {
				if (waiters.get(part.id) === settle) {
					waiters.delete(part.id);
					useToolFeedbackStore.getState().set("awaiting", part.id, false);
				}
				reject(signal.reason);
			};
			waiters.set(part.id, settle);
			useToolFeedbackStore.getState().set("awaiting", part.id, true);
			signal.addEventListener("abort", onAbort, { once: true });
		});
	},

	/**
	 * Answers a call a live generation is waiting on. False if none is, and
	 * the answer has to resume one.
	 */
	give: (id: string, answer: ToolFeedback): boolean => {
		const waiter = waiters.get(id);
		if (!waiter) return false;
		waiters.delete(id);
		const store = useToolFeedbackStore.getState();
		store.set("awaiting", id, false);
		store.set("answered", id, true);
		waiter(answer);
		return true;
	},

	/** Holds an answer for the generation it is about to resume. */
	hold: (id: string, answer: ToolFeedback) => {
		answers.set(id, answer);
		useToolFeedbackStore.getState().set("answered", id, true);
	},

	/** Forgets a call's answer once it has a result, or will not get one. */
	settle: (id: string) => {
		answers.delete(id);
		useToolFeedbackStore.getState().set("answered", id, false);
	},
} as const;
