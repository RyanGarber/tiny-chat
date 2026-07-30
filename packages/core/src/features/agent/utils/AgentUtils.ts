import type { zDataPart } from "../../data/types/message.ts";
import { DataUtils } from "../../data/utils/DataUtils.ts";
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
	}): { prompt: zAgentMessage; index: number } => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (
				messages[i].author === "USER" &&
				DataUtils.getText(messages[i]).length > 0
			) {
				return { prompt: messages[i], index: i };
			}
		}
		throw new Error("No user message in context");
	},

	/**
	 * Get all upload IDs referenced in a chat.
	 */
	getAllUploadIds: ({ messages }: { messages: zAgentMessage[] }): string[] => {
		const uploads = new Set<string>();
		for (const message of messages) {
			for (const skill of message.config?.skills ?? []) {
				const uri = PathUtils.fromMount({ path: skill });
				if (uri?.uploadId) uploads.add(uri.uploadId);
			}
			for (const part of message.data.flat()) {
				if (part.type === "upload") uploads.add(part.id);
			}
		}
		return Array.from(uploads);
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
