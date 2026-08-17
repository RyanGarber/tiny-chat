import type { zDataPart } from "../../data/types/message.ts";
import { DataUtils } from "../../data/utils/DataUtils.ts";
import { DirectiveUtils } from "../../data/utils/DirectiveUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zAgentMessage } from "../types/agent.ts";

export const AgentUtils = {
	/**
	 * Get the last user message in a chat.
	 */
	getLastPrompt: ({
		messages,
	}: {
		messages: zAgentMessage[];
	}): { prompt?: zAgentMessage; index?: number } => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (
				messages[i].author === "USER" &&
				DataUtils.getText(messages[i]).length > 0
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
	 * config, and an upload by an attachment directive written in its text — so
	 * referencing any path below one, not just its root, is what pulls it in.
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
				if (part.type !== "text") continue;
				for (const { directive } of DirectiveUtils.extractFromMarkdown(
					part.value,
					"attachment",
				)) {
					add(uploads, directive?.attributes.source);
				}
			}
		}

		return { uploads: Array.from(uploads), skills: Array.from(skills) };
	},

	/**
	 * Sort tool calls and results together for compatibility.
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

		let resultCount = 0;
		return data.map((part) => {
			if (part.type === "toolResult") return sorted[resultCount++];
			return part;
		});
	},
} as const;
