import { CommonUtils } from "../../../core/utils/CommonUtils.ts";

/** Parent id -> selected child id; the empty key selects a root message. */
export type MessageBranches = Record<string, string>;
export type BranchMessage = {
	id: string;
	previousId: string | null;
	createdAt: Date | Temporal.PlainDateTime;
};

export const MessageBranchUtils = {
	index: <T extends BranchMessage>(messages: readonly T[]) => {
		const byId = new Map(messages.map((message) => [message.id, message]));
		const children = new Map<string | null, T[]>();
		for (const message of [...messages].sort(
			(a, b) =>
				CommonUtils.toDate(a.createdAt).getTime() -
					CommonUtils.toDate(b.createdAt).getTime() || a.id.localeCompare(b.id),
		)) {
			const siblings = children.get(message.previousId) ?? [];
			siblings.push(message);
			children.set(message.previousId, siblings);
		}
		return { byId, children };
	},

	/** Recreate the path through start, including its ancestors, then selected
	 * descendants. Unspecified (or deleted) selections always use branch 0. */
	getBranch: <T extends BranchMessage>(
		messages: readonly T[],
		start?: string | null,
		branches: MessageBranches = {},
	): T[] => {
		const { byId, children } = MessageBranchUtils.index(messages);
		const path: T[] = [];
		const seen = new Set<string>();
		let current = start ? byId.get(start) : undefined;
		if (start && !current)
			throw new Error(`Message ${start} is not in this chat`);
		while (current) {
			if (seen.has(current.id)) throw new Error("Message cycle detected");
			seen.add(current.id);
			path.push(current);
			current = current.previousId ? byId.get(current.previousId) : undefined;
		}
		path.reverse();
		let parent = start ?? null;
		while (true) {
			const siblings = children.get(parent) ?? [];
			const next =
				siblings.find((m) => m.id === branches[parent ?? ""]) ?? siblings[0];
			if (!next) break;
			if (seen.has(next.id)) throw new Error("Message cycle detected");
			seen.add(next.id);
			path.push(next);
			parent = next.id;
		}
		return path;
	},

	/** Every descendant, in parent-before-child order, excluding start. */
	getDescendants: <T extends BranchMessage>(
		messages: readonly T[],
		start: string,
	): T[] => {
		const { children } = MessageBranchUtils.index(messages);
		const result: T[] = [];
		const queue = [start];
		const seen = new Set(queue);
		for (let i = 0; i < queue.length; i++) {
			for (const child of children.get(queue[i]) ?? []) {
				if (seen.has(child.id)) throw new Error("Message cycle detected");
				seen.add(child.id);
				queue.push(child.id);
				result.push(child);
			}
		}
		return result;
	},
} as const;
