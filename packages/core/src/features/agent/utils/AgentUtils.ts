import type { zDataPart } from "../../data/types/part.ts";
import { DataUtils } from "../../data/utils/DataUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zAgentMessage } from "../types/agent.ts";

export const AgentUtils = {
	/**
	 * Get the last user message in a chat.
	 */
	getLastPrompt: ({
		messages,
		withText,
	}: {
		messages: zAgentMessage[];
		withText: boolean;
	}): { prompt?: zAgentMessage; index?: number } => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (
				messages[i].author === "USER" &&
				(!withText || DataUtils.getText(messages[i]).length > 0)
			) {
				return { prompt: messages[i], index: i };
			}
		}
		return { prompt: undefined, index: undefined };
	},

	/**
	 * Get the uploads and skills a set of messages points into.
	 *
	 * Neither has any standing in a chat of its own: it is there because
	 * something in the chat points into it. A skill is named by the message's
	 * config, and an upload by an attachment part — so referencing any path
	 * below one, not just its root, is what pulls it in.
	 *
	 * This is the whole of what a filesystem is built from, which is why it asks
	 * for messages and nothing else: a message being typed has these references
	 * in it just as well as one already saved to a chat.
	 */
	getMounts: ({
		messages,
	}: {
		messages: zAgentMessage[];
	}): { uploads: string[]; skills: string[] } => {
		const uploads = new Set<string>();
		const skills = new Set<string>();

		const add = (into: Set<string>, path?: string) => {
			if (!path) return;
			const uri = PathUtils.fromMount({ path });
			if (uri?.id) into.add(uri.id);
		};

		for (const message of messages) {
			for (const skill of message.config?.skills ?? []) {
				add(skills, skill);
			}
			for (const part of message.data.flat()) {
				if (part.type === "attachment") {
					add(uploads, part.source);
				}
			}
		}

		return { uploads: Array.from(uploads), skills: Array.from(skills) };
	},

	/**
	 * Puts a step's tool results in the order of its calls, straight after the
	 * last of them. Results land in the order calls finish, and one the user
	 * gave later (an approval) lands after anything that followed, like a
	 * background call reporting in; providers want every result straight after
	 * the calls, in their order.
	 */
	getToolResultsSorted: ({ data }: { data: zDataPart[] }) => {
		const toolCalls = data.filter((part) => part.type === "toolCall");
		const toolResults = data.filter((part) => part.type === "toolResult");

		if (!toolCalls.length || !toolResults.length) return data;

		const sorted: zDataPart[] = [];
		const indexes = new Set<number>();

		for (const call of toolCalls) {
			const matchIndex = toolResults.findIndex(
				(result, i) => result.id === call.id && !indexes.has(i),
			);
			if (matchIndex !== -1) {
				sorted.push(toolResults[matchIndex]);
				indexes.add(matchIndex);
			}
		}

		// Append any leftover/unmatched results
		toolResults.forEach((result, i) => {
			if (!indexes.has(i)) sorted.push(result);
		});

		const rest = data.filter((part) => part.type !== "toolResult");
		const after = rest.findLastIndex((part) => part.type === "toolCall") + 1;
		return [...rest.slice(0, after), ...sorted, ...rest.slice(after)];
	},
} as const;
