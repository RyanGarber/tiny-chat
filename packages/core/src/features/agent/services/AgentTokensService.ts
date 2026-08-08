import type {
	zConfig,
	zDataBasicPart,
	zDataPart,
} from "../../data/types/message.ts";
import { FileUtils } from "../../file/utils/FileUtils.ts";
import type { zAgentMessage } from "../types/agent.ts";

/**
 * AgentTokensService — estimating and, when it has to, shrinking the context.
 *
 * Compaction is ordered by what a working agent can afford to lose, not by
 * position in the transcript:
 *
 *   1. Reasoning it has already acted on.
 *   2. Tool output it can reproduce by running the tool again.
 *   3. Files and structured payloads, excerpted rather than dropped.
 *   4. Long prose from the middle of the conversation, excerpted.
 *   5. Whole middle turns, replaced by a digest that keeps what was asked and
 *      what was done about it.
 *   6. Only then anything recent.
 *
 * Two messages are pinned throughout: the first user message, which states the
 * task, and the most recent one, which states what is being asked now. Losing
 * either is how an agent forgets what it is doing, so they are the last things
 * to go rather than — as is easiest to implement — the first.
 *
 * Within every stage the largest payload is compacted first, so a single
 * oversized tool result is given up before a dozen useful small ones.
 */

const CHARS_PER_TOKEN = 3.5;

/** Steps at the end of the transcript that count as the work in progress. */
const RECENT_STEPS = 3;

/** Characters kept when excerpting prose from the middle of a conversation. */
const TEXT_EXCERPT_CHARS = 600;

/** Characters kept when excerpting a pinned message as a last resort. */
const PINNED_EXCERPT_CHARS = 4_000;

/** Characters kept from a text file that is no longer being worked on. */
const FILE_EXCERPT_CHARS = 2_000;

/** Ceiling applied to any single part before compaction even starts. */
const MAX_ANYWHERE_CHARS = 50_000;

/** Characters of a digested turn's text that survive. */
const DIGEST_TEXT_CHARS = 400;

export type TokenBreakdown = {
	memories: number;
	instructions: number;
	text: number;
	thoughts: number;
	files: number;
	tools: number;
	other: number;
	total: number;
};

const cloneMessages = (messages: zAgentMessage[]): zAgentMessage[] =>
	structuredClone(messages);

const getSerialized = (value: unknown): string => {
	if (value === null || value === undefined) return "";
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return String(value);
	}
};

const getSerializedLength = (value: unknown): number =>
	getSerialized(value).length;

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

const getPartTokens = (part: zDataPart | zDataBasicPart): number =>
	getPartLength(part) / CHARS_PER_TOKEN;

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

/**
 * Markers name the tool and the size of what was dropped, so the model can tell
 * the difference between "nothing was found" and "this was elided".
 */
const getToolResultMarker = (
	part: Extract<zDataPart, { type: "toolResult" }>,
): string => {
	const parts = [...part.value, ...(part.append ?? [])];
	const bytes = parts.reduce((total, value) => total + getByteLength(value), 0);
	const lines = getLineCount(parts);
	const detail = [lines > 0 ? `${lines} lines` : null, `${bytes} bytes`]
		.filter(Boolean)
		.join(", ");
	return `[${part.name} result elided to save context: ${detail}. Run the tool again if you still need it.]`;
};

const getFileMarker = (part: Extract<zDataPart, { type: "file" }>): string => {
	const bytes = Math.floor((part.data.length * 3) / 4);
	return `[file elided: ${part.name ?? part.mime}, ${bytes} bytes]`;
};

/**
 * Stand-in for a part that is dropped rather than emptied. Compaction cannot
 * splice arrays while it holds indexes into them, so removals are marked with
 * this exact object and filtered out once every stage has run.
 */
const OMITTED: zDataPart = Object.freeze({ type: "text", value: "" });

const getExcerpt = (text: string, length: number): string => {
	if (text.length <= length) return text;
	const marker = "\n[… middle of content omitted …]\n";
	const sideLength = Math.floor((length - marker.length) / 2);
	return `${text.slice(0, sideLength)}${marker}${text.slice(-sideLength)}`;
};

/** Identifies a tool call by the argument that says what it acted on. */
const getArgumentSummary = (args: unknown): string => {
	if (!args || typeof args !== "object") return "";
	const record = args as Record<string, unknown>;
	const value =
		record.path ?? record.query ?? record.command ?? record.url ?? record.name;
	if (typeof value !== "string") return "";
	return value.length > 80 ? `${value.slice(0, 80)}…` : value;
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
): zDataPart => ({
	...part,
	value: [{ type: "text", value: getToolResultMarker(part) }],
	append: undefined,
});

function compactLivePart(
	part: zDataBasicPart,
	useMarker: boolean,
): zDataBasicPart;
function compactLivePart(part: zDataPart, useMarker: boolean): zDataPart;
function compactLivePart(
	part: zDataPart | zDataBasicPart,
	useMarker: boolean,
): zDataPart | zDataBasicPart {
	if (part.type === "toolResult") {
		return {
			...part,
			value: part.value.map((value) => compactLivePart(value, useMarker)),
			append: part.append?.map((value) => compactLivePart(value, useMarker)),
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
					? "[reasoning elided; signature preserved]"
					: "[content elided]"
				: "",
		};
	}
	if (part.type === "toolCall") {
		return { ...part, args: useMarker ? { compacted: true } : null };
	}
	return part;
}

function preprocessParts(parts: zDataBasicPart[]): zDataBasicPart[];
function preprocessParts(parts: zDataPart[]): zDataPart[];
function preprocessParts(
	parts: zDataPart[] | zDataBasicPart[],
): zDataPart[] | zDataBasicPart[] {
	parts.forEach((part, index) => {
		if (part.type === "toolResult") {
			preprocessParts(part.value);
			if (part.append) preprocessParts(part.append);
		}
		if (part.type === "file") {
			try {
				const text = FileUtils.getTextFromBytes(part);
				if (text !== null) {
					replaceIfSmaller(parts, index, {
						type: "text",
						value: getExcerpt(text, MAX_ANYWHERE_CHARS),
					});
				}
			} catch {
				// binary will be handled by generic compaction
			}
		}
		if (part.type === "json") {
			replaceIfSmaller(parts, index, {
				...part,
				value: getExcerpt(JSON.stringify(part.value), MAX_ANYWHERE_CHARS),
			});
		}
		// if text or thoughts ever get big enough to trigger this, we got bigger problems...
		if (part.type === "text" || part.type === "thought") {
			replaceIfSmaller(parts, index, {
				...part,
				value: getExcerpt(part.value, MAX_ANYWHERE_CHARS),
			});
		}
	});
	return parts;
}

/** One part, with everything a compaction stage needs to judge it. */
interface Entry {
	message: zAgentMessage;
	messageIndex: number;
	parts: zDataPart[];
	index: number;
	part: zDataPart;
	/** Steps from the end of the transcript; 0 is the step being written now. */
	age: number;
	/** In the window of steps that make up the work in progress. */
	recent: boolean;
	/** Belongs to the message that set the task, or the one asking now. */
	pinned: boolean;
}

/** A single compaction, priced before it is applied. */
interface Candidate {
	/** Tokens this saves. Candidates that save nothing are never collected. */
	saving: number;
	apply: () => void;
}

const getEntries = (messages: zAgentMessage[]): Entry[] => {
	let firstUser = -1;
	let lastUser = -1;
	messages.forEach((message, index) => {
		if (message.author !== "USER") return;
		if (firstUser === -1) firstUser = index;
		lastUser = index;
	});

	// Steps, not messages, are the unit of recency: one agentic turn can hold a
	// hundred of them inside a single message.
	const steps: { messageIndex: number; parts: zDataPart[] }[] = [];
	messages.forEach((message, messageIndex) => {
		for (const parts of message.data) steps.push({ messageIndex, parts });
	});

	const entries: Entry[] = [];
	steps.forEach((step, stepIndex) => {
		const age = steps.length - 1 - stepIndex;
		step.parts.forEach((part, index) => {
			entries.push({
				message: messages[step.messageIndex],
				messageIndex: step.messageIndex,
				parts: step.parts,
				index,
				part,
				age,
				recent: age < RECENT_STEPS,
				pinned:
					step.messageIndex === firstUser || step.messageIndex === lastUser,
			});
		});
	});

	return entries;
};

/**
 * What a turn was about, in a few lines: what was asked, what was done about
 * it, and how it ended. Enough for the model to keep its bearings after the
 * turn itself is gone.
 */
const getDigest = (message: zAgentMessage): string => {
	const texts: string[] = [];
	const calls: string[] = [];

	for (const part of message.data.flat()) {
		if (part.type === "text" && part.value.trim())
			texts.push(part.value.trim());
		if (part.type === "toolCall") {
			const summary = getArgumentSummary(part.args);
			calls.push(summary ? `${part.name}(${summary})` : part.name);
		}
	}

	const counts = new Map<string, number>();
	for (const call of calls) counts.set(call, (counts.get(call) ?? 0) + 1);
	const actions = [...counts.entries()]
		.slice(0, 8)
		.map(([call, count]) => (count > 1 ? `${call} ×${count}` : call))
		.join(", ");

	const role = message.author === "USER" ? "user" : "assistant";
	const text = texts.join("\n").trim();

	return [
		`[earlier ${role} turn, summarized]`,
		text ? getExcerpt(text, DIGEST_TEXT_CHARS) : null,
		actions ? `tools used: ${actions}` : null,
	]
		.filter(Boolean)
		.join("\n");
};

/**
 * Replaces a message's contents with its digest, keeping the `<message>`
 * framing that {@link AgentMessagesService} wrapped around it.
 */
const setDigest = (message: zAgentMessage) => {
	const digest: zDataPart = { type: "text", value: getDigest(message) };

	const opening = message.data[0]?.[0];
	const closing = message.data.at(-1)?.at(-1);
	const opens =
		opening?.type === "text" && opening.value.startsWith("<message");
	const closes = closing?.type === "text" && closing.value === "</message>";

	message.data = [
		[
			...(opens && opening ? [opening] : []),
			digest,
			...(closes && closing ? [closing] : []),
		],
	];
};

/** Payload-only compaction of one part, preserving its position and signature. */
const getLiveCandidate = (entry: Entry): Candidate[] => {
	const part = entry.part;

	const replacement: zDataPart =
		entry.pinned && part.type === "text"
			? { ...part, value: getExcerpt(part.value, PINNED_EXCERPT_CHARS) }
			: compactLivePart(part, true);

	const saving = getPartTokens(part) - getPartTokens(replacement);
	if (saving <= 0) return [];

	return [
		{
			saving,
			apply: () => {
				entry.parts[entry.index] = replacement;
			},
		},
	];
};

/**
 * The stages of compaction, cheapest loss first. Each one is offered every
 * part still in the transcript and returns the compactions it would make; the
 * caller applies as many as the budget requires and stops.
 */
const stages: {
	name: string;
	collect: (_: { entries: Entry[]; messages: zAgentMessage[] }) => Candidate[];
}[] = [
	{
		// Reasoning is the model talking to itself about a step it has finished.
		// Once the step is behind it, the text is dead weight — and altering a
		// signed thinking block is worse than removing it, so it goes whole.
		name: "stale reasoning",
		collect: ({ entries }) =>
			entries
				.filter((entry) => !entry.recent && entry.part.type === "thought")
				.map((entry) => ({
					saving: getPartTokens(entry.part),
					apply: () => {
						entry.parts[entry.index] = OMITTED;
					},
				})),
	},
	{
		// Tool output is the largest and most reproducible thing in the window.
		// The call that produced it stays, so the model keeps the trail.
		name: "old tool output",
		collect: ({ entries }) =>
			entries
				.filter((entry) => !entry.recent && entry.part.type === "toolResult")
				.flatMap((entry) => {
					const part = entry.part as Extract<zDataPart, { type: "toolResult" }>;
					const replacement = compactToolResult(part);
					const saving = getPartTokens(part) - getPartTokens(replacement);
					if (saving <= 0) return [];
					return [
						{
							saving,
							apply: () => {
								entry.parts[entry.index] = replacement;
							},
						},
					];
				}),
	},
	{
		// Files keep their head and tail: enough to recognise, not enough to hurt.
		name: "old files and payloads",
		collect: ({ entries }) =>
			entries
				.filter(
					(entry) =>
						!entry.recent &&
						(entry.part.type === "file" || entry.part.type === "json"),
				)
				.flatMap((entry) => {
					const part = entry.part;
					let replacement: zDataPart | null = null;

					if (part.type === "file") {
						let text: string | null = null;
						try {
							text = FileUtils.getTextFromBytes(part);
						} catch {
							text = null;
						}
						replacement = {
							type: "text",
							value:
								text === null
									? getFileMarker(part)
									: `${getFileMarker(part)}\n${getExcerpt(text, FILE_EXCERPT_CHARS)}`,
							signature: part.signature,
						};
					} else if (part.type === "json") {
						replacement = {
							...part,
							value: getExcerpt(getSerialized(part.value), FILE_EXCERPT_CHARS),
						};
					}

					if (!replacement) return [];
					const saving = getPartTokens(part) - getPartTokens(replacement);
					if (saving <= 0) return [];
					return [
						{
							saving,
							apply: () => {
								entry.parts[entry.index] = replacement as zDataPart;
							},
						},
					];
				}),
	},
	{
		// Prose from the middle of the conversation, cut to its opening and
		// closing — which is where intent and conclusions live.
		name: "old prose",
		collect: ({ entries }) =>
			entries
				.filter(
					(entry) =>
						!entry.recent && !entry.pinned && entry.part.type === "text",
				)
				.flatMap((entry) => {
					const part = entry.part as Extract<zDataPart, { type: "text" }>;
					const replacement: zDataPart = {
						...part,
						value: getExcerpt(part.value, TEXT_EXCERPT_CHARS),
					};
					const saving = getPartTokens(part) - getPartTokens(replacement);
					if (saving <= 0) return [];
					return [
						{
							saving,
							apply: () => {
								entry.parts[entry.index] = replacement;
							},
						},
					];
				}),
	},
	{
		// Whole turns from the middle, replaced by what they were about. The
		// first and most recent user messages are never eligible.
		name: "old turns",
		collect: ({ entries, messages }) => {
			const eligible = new Map<number, Entry[]>();
			for (const entry of entries) {
				if (entry.recent || entry.pinned) continue;
				const group = eligible.get(entry.messageIndex) ?? [];
				group.push(entry);
				eligible.set(entry.messageIndex, group);
			}

			return [...eligible.entries()].flatMap(([messageIndex, group]) => {
				const message = messages[messageIndex];
				const before = message.data
					.flat()
					.reduce((tokens, part) => tokens + getPartTokens(part), 0);
				const saving = before - getDigest(message).length / CHARS_PER_TOKEN;
				if (saving <= 0 || !group.length) return [];
				return [
					{
						saving,
						apply: () => setDigest(message),
					},
				];
			});
		},
	},
	{
		// Into the working set: tool output from the current turn, oldest and
		// largest first, but never from the step being written.
		name: "recent tool output",
		collect: ({ entries }) =>
			entries
				.filter(
					(entry) =>
						entry.recent && entry.age > 0 && entry.part.type === "toolResult",
				)
				.flatMap((entry) => {
					const part = entry.part as Extract<zDataPart, { type: "toolResult" }>;
					const replacement = compactToolResult(part);
					const saving = getPartTokens(part) - getPartTokens(replacement);
					if (saving <= 0) return [];
					return [
						{
							saving,
							apply: () => {
								entry.parts[entry.index] = replacement;
							},
						},
					];
				}),
	},
	{
		// Last resort with the transcript still intact: every part keeps its
		// position and its signature, and gives up only its payload. Pinned
		// messages keep a generous excerpt rather than a marker.
		name: "working set",
		collect: ({ entries }) =>
			entries.filter((entry) => entry.age > 0).flatMap(getLiveCandidate),
	},
	{
		// The step being written now, which the model needs in full to continue
		// the loop it is in the middle of. Nothing above it was enough.
		name: "current step",
		collect: ({ entries }) =>
			entries.filter((entry) => entry.age === 0).flatMap(getLiveCandidate),
	},
	{
		// The markers themselves can exceed an unusually small budget. Payloads
		// empty out; positions and signatures still survive.
		name: "empty payloads",
		collect: ({ entries }) =>
			entries.flatMap((entry) => {
				const replacement = compactLivePart(entry.part, false);
				const saving = getPartTokens(entry.part) - getPartTokens(replacement);
				if (saving <= 0) return [];
				return [
					{
						saving,
						apply: () => {
							entry.parts[entry.index] = replacement;
						},
					},
				];
			}),
	},
];

export const AgentTokensService = {
	/**
	 * Truncates any severely long part as an always-on first pass.
	 */
	preprocessMessages: ({
		messages,
	}: {
		messages: zAgentMessage[];
	}): zAgentMessage[] => {
		const processed = cloneMessages(messages);

		for (const message of processed) {
			for (const parts of message.data) {
				preprocessParts(parts);
			}
		}

		return processed;
	},

	/**
	 * Trims messages and data to fit the given token limit.
	 */
	trimMessages: async ({
		instructions,
		messages: _messages,
		config,
	}: {
		instructions?: string;
		messages: zAgentMessage[];
		config: zConfig;
	}): Promise<zAgentMessage[]> => {
		const messages = AgentTokensService.preprocessMessages({
			messages: _messages,
		});

		if (config.args?.["tokens-in"] === undefined) {
			console.warn(
				"[AgentTokensService] no `tokens-in` arg, skipping compaction",
			);
			return messages;
		}

		const target = Math.max(0, config.args["tokens-in"]);
		let tokens = AgentTokensService.getTokens({ instructions, messages });

		console.log("[AgentTokensService] estimated tokens:", tokens);

		if (tokens <= target) {
			console.log("[AgentTokensService] no compaction needed");
			return messages;
		}

		for (const stage of stages) {
			if (tokens <= target) break;

			// Recollected per stage, so each one prices what the last ones left.
			const candidates = stage
				.collect({ entries: getEntries(messages), messages })
				.filter((candidate) => candidate.saving > 0)
				// Largest payload first: one bloated result should go before many
				// small ones that each carry as much meaning as it does.
				.sort((a, b) => b.saving - a.saving);

			let applied = 0;
			for (const candidate of candidates) {
				if (tokens <= target) break;
				candidate.apply();
				tokens -= candidate.saving;
				applied++;
			}

			if (applied) {
				console.log(
					`[AgentTokensService] compacted ${applied} part(s) at stage '${stage.name}', now ~${Math.round(tokens)} tokens`,
				);
			}
		}

		// Dropped parts were only marked in place; take them out now that no
		// stage is holding an index into the arrays they sit in.
		for (const message of messages) {
			message.data = message.data
				.map((parts) => parts.filter((part) => part !== OMITTED))
				.filter((parts) => parts.length);
		}

		const finalTokens = AgentTokensService.getTokens({
			instructions,
			messages,
		});
		console.log(
			"[AgentTokensService] estimated tokens after compaction:",
			finalTokens,
		);
		return messages;
	},

	getTokens: ({
		instructions = "",
		messages = [],
	}: {
		instructions?: string;
		messages?: zAgentMessage[];
	}): number => {
		return AgentTokensService.getTokenBreakdown({
			instructions,
			messages,
		}).total;
	},

	getTokenBreakdown: ({
		instructions = "",
		messages = [],
	}: {
		instructions?: string;
		messages?: zAgentMessage[];
	}): TokenBreakdown => {
		const memories =
			/^<memories>$(.*)^<\/memories>$/ms.exec(instructions)?.[1]?.length ?? 0;
		const tokens = (part: zDataPart) => getPartLength(part) / CHARS_PER_TOKEN;
		const categories: Omit<TokenBreakdown, "total"> = {
			...AgentTokensService.zero,
			memories: memories / CHARS_PER_TOKEN,
			instructions: (instructions.length - memories) / CHARS_PER_TOKEN,
		};
		for (const part of messages.flatMap((message) => message.data.flat())) {
			if (part.type === "text") categories.text += tokens(part);
			else if (part.type === "thought") categories.thoughts += tokens(part);
			else if (part.type === "file") categories.files += tokens(part);
			else if (part.type === "toolCall" || part.type === "toolResult")
				categories.tools += tokens(part);
			else categories.other += tokens(part);
		}
		return {
			...categories,
			total: Object.values(categories).reduce(
				(total, tokens) => total + tokens,
				0,
			),
		};
	},

	zero: {
		text: 0,
		thoughts: 0,
		files: 0,
		tools: 0,
		other: 0,
		memories: 0,
		instructions: 0,
		total: 0,
	} satisfies TokenBreakdown,
} as const;
