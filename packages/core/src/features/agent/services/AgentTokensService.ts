import type {
	zConfig,
	zDataBasicPart,
	zDataPart,
} from "../../data/types/message.ts";
import { FileUtils } from "../../file/utils/FileUtils.ts";
import type { zAgentMessage } from "../types/agent.ts";

const CHARS_PER_TOKEN = 3.5;
const OLD_FILE_TURNS = 5;
const FILE_EXCERPT_CHARS = 2_000;

const cloneMessages = (messages: zAgentMessage[]): zAgentMessage[] =>
	structuredClone(messages);

const getSerializedLength = (value: unknown): number => {
	if (value === null || value === undefined) return 0;
	try {
		return JSON.stringify(value)?.length ?? 0;
	} catch {
		return String(value).length;
	}
};

const getPartLength = (part: zDataPart | zDataBasicPart): number => {
	if (part.type === "text" || part.type === "thought") return part.value.length;
	if (part.type === "toolCall") return getSerializedLength(part.args);
	if (part.type === "toolResult") {
		return [...part.value, ...(part.append ?? [])].reduce(
			(length, value) => length + getPartLength(value),
			0,
		);
	}
	if (part.type === "file") return part.data.length * (2 / 3);
	if (part.type === "json") return getSerializedLength(part.value);
	return 0;
};

const getByteLength = (part: zDataBasicPart): number => {
	if (part.type === "file") return Math.floor((part.data.length * 3) / 4);
	if (part.type === "text") return new TextEncoder().encode(part.value).length;
	return new TextEncoder().encode(JSON.stringify(part.value) ?? "").length;
};

const getLineCount = (parts: zDataBasicPart[]): number =>
	parts.reduce((lines, part) => {
		if (part.type === "text") return lines + part.value.split("\n").length;
		if (part.type === "file") {
			try {
				const text = FileUtils.getTextFromBytes(part);
				if (text !== null) return lines + text.split("\n").length;
			} catch {
				// A malformed file can still be compacted by byte size.
			}
		}
		return lines;
	}, 0);

const getToolResultMarker = (parts: zDataBasicPart[]): string => {
	const bytes = parts.reduce((total, part) => total + getByteLength(part), 0);
	const lines = getLineCount(parts);
	const detail = [lines > 0 ? `${lines} lines` : null, `${bytes} bytes`]
		.filter(Boolean)
		.join(", ");
	return `[tool result compacted: ${detail} omitted]`;
};

const getFileMarker = (part: Extract<zDataPart, { type: "file" }>): string => {
	const bytes = Math.floor((part.data.length * 3) / 4);
	return `[file compacted: ${part.name ?? part.mime}, ${bytes} bytes omitted]`;
};

const getExcerpt = (text: string): string => {
	if (text.length <= FILE_EXCERPT_CHARS) return text;
	const marker = "\n[… middle of file omitted …]\n";
	const sideLength = Math.floor((FILE_EXCERPT_CHARS - marker.length) / 2);
	return `${text.slice(0, sideLength)}${marker}${text.slice(-sideLength)}`;
};

const replaceIfSmaller = (
	parts: zDataPart[],
	index: number,
	replacement: zDataPart,
): boolean => {
	if (getPartLength(replacement) >= getPartLength(parts[index])) return false;
	parts[index] = replacement;
	return true;
};

const compactToolResult = (
	part: Extract<zDataPart, { type: "toolResult" }>,
): zDataPart => {
	const values = [...part.value, ...(part.append ?? [])];
	return {
		...part,
		value: [{ type: "text", value: getToolResultMarker(values) }],
		append: undefined,
	};
};

const compactHistoricalPart = (part: zDataPart): zDataPart => {
	if (part.type === "toolResult") return compactToolResult(part);
	if (part.type === "file") {
		return {
			type: "text",
			value: getFileMarker(part),
			signature: part.signature,
		};
	}
	if (part.type === "json") {
		return {
			type: "text",
			value: "[structured data omitted during context compaction]",
			id: part.id,
			signature: part.signature,
		};
	}
	if (part.type === "thought") {
		return { ...part, value: "[earlier reasoning omitted]" };
	}
	if (part.type === "text") {
		return { ...part, value: "[earlier content omitted]" };
	}
	if (part.type === "toolCall") {
		return { ...part, args: { compacted: true } };
	}
	return part;
};

const compactLiveBasicPart = (
	part: zDataBasicPart,
	useMarker: boolean,
): zDataBasicPart => {
	if (part.type === "text") {
		return { ...part, value: useMarker ? "[tool output omitted]" : "" };
	}
	if (part.type === "json") return { ...part, value: useMarker ? null : null };
	return {
		type: "text",
		id: part.id,
		value: useMarker ? getFileMarker(part) : "",
		signature: part.signature,
	};
};

const compactLivePart = (part: zDataPart, useMarker: boolean): zDataPart => {
	if (part.type === "toolResult") {
		return {
			...part,
			value: part.value.map((value) => compactLiveBasicPart(value, useMarker)),
			append: part.append?.map((value) =>
				compactLiveBasicPart(value, useMarker),
			),
		};
	}
	if (part.type === "file") {
		return {
			type: "text",
			id: part.id,
			value: useMarker ? getFileMarker(part) : "",
			signature: part.signature,
		};
	}
	if (part.type === "json") {
		return { ...part, value: null };
	}
	if (part.type === "text" || part.type === "thought") {
		return {
			...part,
			value: useMarker
				? part.type === "thought"
					? "[current reasoning text compacted; signature preserved]"
					: "[current content compacted]"
				: "",
		};
	}
	if (part.type === "toolCall") {
		return { ...part, args: useMarker ? { compacted: true } : null };
	}
	return part;
};

const forEachPart = (
	message: zAgentMessage,
	callback: (parts: zDataPart[], index: number) => void,
): void => {
	for (const parts of message.data) {
		for (let index = 0; index < parts.length; index++) callback(parts, index);
	}
};

export const AgentTokensService = {
	/**
	 * Trims messages and data to fit the given token limit.
	 */
	trimMessages: async ({
		messages,
		config,
	}: {
		messages: zAgentMessage[];
		config: zConfig;
	}): Promise<zAgentMessage[]> => {
		const targetTokens = Math.max(0, config.tokens);
		const compacted = cloneMessages(messages);
		const initialTokens = AgentTokensService.getTokens({ messages: compacted });
		const overBudget = () =>
			AgentTokensService.getTokens({ messages: compacted }) > targetTokens;

		console.log(
			"[AgentTokensService] estimated tokens before compaction:",
			initialTokens,
		);

		if (!overBudget()) return compacted;

		const liveMessage = compacted.at(-1);
		const historicalMessages = liveMessage ? compacted.slice(0, -1) : compacted;

		// Observation masking gives up bulky, reproducible tool output before dialogue.
		for (const message of historicalMessages) {
			forEachPart(message, (parts, index) => {
				if (!overBudget()) return;
				const part = parts[index];
				if (part.type === "toolResult") {
					replaceIfSmaller(parts, index, compactToolResult(part));
				}
			});
		}

		// Old text files retain useful beginnings/endings. Binary and image files are
		// left intact until whole old turns or generic historical payloads are compacted.
		for (
			let messageIndex = 0;
			messageIndex < historicalMessages.length;
			messageIndex++
		) {
			if (!overBudget()) break;
			const turnsAgo = historicalMessages
				.slice(messageIndex + 1)
				.filter((message) => message.author === "USER").length;
			if (turnsAgo < OLD_FILE_TURNS) continue;
			forEachPart(historicalMessages[messageIndex], (parts, index) => {
				if (!overBudget()) return;
				const part = parts[index];
				if (part.type !== "file") return;
				try {
					const text = FileUtils.getTextFromBytes(part);
					if (text !== null) {
						replaceIfSmaller(parts, index, {
							type: "text",
							value: `${getFileMarker(part)}\n${getExcerpt(text)}`,
							signature: part.signature,
						});
					}
				} catch {
					// Invalid encoded data is handled by later generic compaction.
				}
			});
		}

		// Remove the oldest complete user/model turns before touching recent context.
		while (overBudget()) {
			let pairIndex = -1;
			for (let index = 0; index < compacted.length - 2; index++) {
				if (
					compacted[index].author === "USER" &&
					compacted[index + 1].author === "MODEL"
				) {
					pairIndex = index;
					break;
				}
			}
			if (pairIndex < 0) break;
			const before = AgentTokensService.getTokens({
				messages: compacted.slice(pairIndex, pairIndex + 2),
			});
			const replacement: zAgentMessage = {
				...compacted[pairIndex],
				id: null,
				data: [
					[{ type: "text", value: "[one earlier conversation turn omitted]" }],
				],
			};
			if (AgentTokensService.getTokens({ messages: [replacement] }) >= before)
				break;
			compacted.splice(pairIndex, 2, replacement);
		}

		// Compact any historical fragments that were not part of complete turns.
		for (
			let messageIndex = 0;
			messageIndex < compacted.length - 1;
			messageIndex++
		) {
			if (!overBudget()) break;
			forEachPart(compacted[messageIndex], (parts, index) => {
				if (!overBudget()) return;
				replaceIfSmaller(parts, index, compactHistoricalPart(parts[index]));
			});
		}

		// The active message owns the running loop's signatures. Preserve every part
		// position and signature while reducing only its visible/reproducible payload.
		if (liveMessage && overBudget()) {
			forEachPart(liveMessage, (parts, index) => {
				if (!overBudget()) return;
				replaceIfSmaller(parts, index, compactLivePart(parts[index], true));
			});
		}

		// Marker text itself may exceed an unusually tiny configured budget. Emptying
		// payloads is the final fallback; live parts and signatures still remain.
		if (overBudget()) {
			for (const message of compacted) {
				forEachPart(message, (parts, index) => {
					if (!overBudget()) return;
					parts[index] = compactLivePart(parts[index], false);
				});
			}
		}

		const finalTokens = AgentTokensService.getTokens({ messages: compacted });
		console.log(
			"[AgentTokensService] estimated tokens after compaction:",
			finalTokens,
		);
		return compacted;
	},

	getTokens: ({
		data = [],
		messages = [],
	}: {
		data?: zDataPart[];
		messages?: zAgentMessage[];
	}): number => {
		const parts = [
			...data,
			...messages.flatMap((message) => message.data.flat()),
		];
		return parts.reduce(
			(tokens, part) => tokens + getPartLength(part) / CHARS_PER_TOKEN,
			0,
		);
	},
};
