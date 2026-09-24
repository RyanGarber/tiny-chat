import type {
	Capabilities,
	ShellCapability,
} from "../../../core/types/capability.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { SettingsUtils } from "../../../core/utils/SettingsUtils.ts";
import { VERBOSE } from "../../../logger.ts";
import type { MemorySearchResult } from "../../data/types/memory.ts";
import type { zAttachmentPart, zDataPart } from "../../data/types/part.ts";
import { DataUtils } from "../../data/utils/DataUtils.ts";
import { EditorPartUtils } from "../../data/utils/EditorPartUtils.ts";
import { FileOperationService } from "../../file/services/FileOperationService.ts";
import { FileTypeUtils } from "../../file/utils/FileTypeUtils.ts";
import { type Descendent, FileUtils } from "../../file/utils/FileUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zAgentContext, zAgentMessage } from "../types/agent.ts";

/** Directory levels shown in an attached folder's XML tree. */
const MAX_ATTACHMENT_TREE_DEPTH = 2;

export const AgentMessagesService = {
	buildMessages: async ({
		context,
		capabilities,
	}: {
		context: zAgentContext;
		capabilities: Capabilities;
	}): Promise<{ messages: zAgentMessage[]; customInstructions?: string }> => {
		const messages: zAgentMessage[] = [];

		const memoryBudget = SettingsUtils.of(
			context.user,
			context.chat?.folder,
		)?.memoryBudget;
		console.log("[AgentMessagesService] memory budget:", memoryBudget);
		const memories = !context.chat?.incognito
			? await capabilities.memories?.retrieveMemories({
					messages: context.messages.map((message) =>
						message.id
							? { id: message.id }
							: { text: DataUtils.getTextCleaned(message) },
					),
					tokens: memoryBudget,
				})
			: undefined;

		let customInstructions: string | undefined;

		for (let i = 0; i < context.messages.length; i++) {
			const message = context.messages[i];
			const previous = context.messages[i - 1];

			const parts: zDataPart[] = message.data.flat();
			const transformedParts: zDataPart[] = [];

			for (const part of parts) {
				if (part.type === "attachment") {
					transformedParts.push(
						...AgentMessagesService.buildAttachmentParts(part),
					);
				} else if (part.type === "quote") {
					const model = part.model ? ` model="${part.model}"` : "";
					transformedParts.push({
						id: part.id,
						type: "text",
						value: `<quote${model}>\n${part.text}\n</quote>`,
					});
				} else if (part.type === "paste") {
					transformedParts.push({
						id: part.id,
						type: "text",
						value: EditorPartUtils.fence(part.text, part.language),
					});
				} else if (part.type === "command") {
					// A skill is written as a command but read as its SKILL.md, which
					// is the only thing about it the model ever sees.
					if (part.value?.startsWith("skill:")) {
						transformedParts.push(
							...(await AgentMessagesService.buildSourceParts({
								capabilities,
								id: part.id,
								source: part.value.slice(6),
							})),
						);
					} else if (part.name === "system-prompt") {
						customInstructions = part.argument;
						console.log(
							"[AgentMessagesService] using custom instructions:",
							part.argument,
						);
					} else {
						console.warn(
							"[AgentMessagesService] ignoring unknown command:",
							part.name,
						);
						transformedParts.push({
							id: part.id,
							type: "text",
							value: EditorPartUtils.toMarkdown(part),
						});
					}
				} else {
					transformedParts.push(part);
				}
			}

			messages.push(
				AgentMessagesService.buildMessageBlock({
					message,
					previous,
					parts: transformedParts,
					timezone: context.timezone,
					memories: memories?.at(i),
				}),
			);
		}

		if (VERBOSE)
			console.log("[AgentMessagesService] built messages:", messages);

		return { messages, customInstructions };
	},

	/**
	 * A path on the host, read now and wrapped the way a stored attachment is.
	 *
	 * Used for the things a message references rather than captures — a skill,
	 * which is named by the command that enabled it and read as its `SKILL.md`.
	 */
	buildSourceParts: async ({
		capabilities,
		id,
		source,
		name,
		directory,
	}: {
		capabilities: Capabilities;
		id: string;
		source: string;
		name?: string;
		directory?: boolean;
	}): Promise<zDataPart[]> => {
		let content: zDataPart | undefined;

		try {
			const shell = PathUtils.fromMount({ path: source })
				? capabilities.chatShell
				: capabilities.shell;

			if (source.startsWith("web:")) {
				const web = await capabilities.web?.view({ url: source.slice(4) });
				if (web) content = { id, type: "text", value: web.content };
			} else if (directory) {
				const xml = await AgentMessagesService.buildDirectoryBlock({
					shell,
					path: source,
				});
				if (xml) content = { id, type: "text", value: xml };
			} else {
				const file = await shell?.readFile({ path: source });
				if (file) {
					content = {
						id: CommonUtils.getRandomId(),
						type: "file",
						name: PathUtils.name(file),
						data: FileUtils.getBase64FromBytes(file),
						mime:
							(await FileTypeUtils.getMime(file)) ?? "application/octet-stream",
					};
				}
			}
		} catch (error: any) {
			console.error("[AgentMessagesService] error reading attachment:", error);
		}

		// An upload is mounted under its id, which says nothing about what it
		// holds, so the name it was attached under stands in for the path.
		const label = name ? ` name="${name}"` : "";

		return [
			{
				id: CommonUtils.getRandomId(),
				type: "text",
				value: `<attachment source="${PathUtils.normalize({ path: source })}"${label}>`,
			},
			content ?? { id, type: "text", value: "<!-- content unavailable -->" },
			{
				id: CommonUtils.getRandomId(),
				type: "text",
				value: "</attachment>",
			},
		];
	},

	buildAttachmentParts: (attachment: zAttachmentPart): zDataPart[] => {
		const source = PathUtils.normalize({ path: attachment.source });
		let content: zDataPart;

		if (attachment.content.type === "file") {
			content = {
				id: attachment.id,
				type: "file",
				name: PathUtils.name(attachment.source),
				mime: attachment.content.mime ?? "application/octet-stream",
				data: attachment.content.data,
			};
		} else if (attachment.content.type === "web") {
			content = {
				id: attachment.id,
				type: "text",
				value: attachment.content.content,
			};
		} else if (attachment.content.type === "directory") {
			content = {
				id: attachment.id,
				type: "text",
				value: AgentMessagesService.buildDirectoryItems({
					path: attachment.source,
					items: attachment.content.items,
				}),
			};
		} else {
			content = {
				id: attachment.id,
				type: "text",
				value: "<!-- content unavailable -->",
			};
		}

		return [
			{
				id: CommonUtils.getRandomId(),
				type: "text",
				value: `<attachment source="${source}" name="${attachment.label}">`,
			},
			content,
			{
				id: CommonUtils.getRandomId(),
				type: "text",
				value: "</attachment>",
			},
		];
	},

	buildDirectoryItems: ({
		path,
		items,
	}: {
		path: string;
		items: { path: string; directory?: boolean }[];
	}) => {
		const base = PathUtils.normalize({ path, unix: true }).replace(/\/+$/, "");
		const nodes = items.map((item) => {
			const normalized = PathUtils.normalize({ path: item.path, unix: true });
			return {
				uri: item.path,
				is_dir: item.directory ?? false,
				path: PathUtils.split(PathUtils.relative({ base, path: normalized })),
			};
		});
		return AgentMessagesService.buildTree({
			tree: FileUtils.toTree({ nodes }),
			depth: 0,
		});
	},

	buildMessageBlock: ({
		message,
		previous,
		parts,
		timezone,
		memories,
	}: {
		message: zAgentMessage;
		previous?: zAgentMessage;
		parts: zDataPart[];
		timezone?: string;
		memories?: MemorySearchResult[];
	}): zAgentMessage => {
		const attributes = {
			role: message.author === "USER" ? "user" : "assistant",
		} as Record<string, string>;

		if (message.author === "MODEL") {
			const model = message.config?.model;
			if (model) attributes.model = model;
		}

		if (message.createdAt) {
			attributes.sent = CommonUtils.formatDate({
				date: message.createdAt,
				timezone,
			});
			if (previous?.createdAt && message.author === "USER") {
				attributes.gap = CommonUtils.formatTimespan({
					from: previous.createdAt,
					to: message.createdAt,
				});
			}
		}

		let contextText = "";
		if (memories && memories.length > 0) {
			contextText += [...memories]
				.sort((a, b) => a.id.localeCompare(b.id))
				.map(
					(memory) =>
						`<memory id="${memory.id}" category="${memory.category}" stability="${memory.stability}" learned="${CommonUtils.formatDate({ date: memory.createdAt, timezone })}">\n${memory.fact}\n</memory>`,
				)
				.join("\n");
		}

		return {
			...message,
			data: [
				[
					...(contextText.length > 0
						? [
								{
									id: CommonUtils.getRandomId(),
									type: "text" as const,
									value: `<context>\n${contextText}\n</context>`,
								},
							]
						: []),
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: `<message${Object.entries(attributes)
							.map(([k, v]) => ` ${k}="${v}"`)
							.join("")}>`,
					},
					...parts,
					{ id: CommonUtils.getRandomId(), type: "text", value: "</message>" },
				],
			],
		};
	},

	buildDirectoryBlock: async ({
		shell,
		path,
	}: {
		shell?: Pick<ShellCapability, "readDir">;
		path: string;
	}) => {
		if (!shell) return null;
		const base = PathUtils.normalize({ path, unix: true }).replace(/\/+$/, "");
		// The tree of an attached directory is the user showing what they sent.
		// Screening it the way a text search does would drop the screenshots and
		// logs that were often the entire reason for attaching it.
		const entries = await FileOperationService.walk({
			shell,
			path,
			scope: "listing",
			includeDirectories: true,
		});

		const nodes = entries.map((entry) => {
			const normalized = PathUtils.normalize({ path: entry.path, unix: true });
			const relative = normalized.replace(
				new RegExp(`^${CommonUtils.escapeRegex(base)}\\/?`),
				"",
			);
			return {
				uri: entry.path,
				is_dir: entry.is_dir,
				path: PathUtils.split(relative),
			};
		});

		const tree = FileUtils.toTree({ nodes });
		return AgentMessagesService.buildTree({ tree, depth: 0 });
	},

	buildTree: <T extends { uri?: string; is_dir?: boolean }>({
		tree,
		depth = 0,
		maxDepth = MAX_ATTACHMENT_TREE_DEPTH,
	}: {
		tree: Descendent<T>;
		depth?: number;
		maxDepth?: number;
	}): string => {
		if (maxDepth <= 0) return "";
		const nodes: string[] = [];
		for (const [segment, child] of tree.children) {
			const isDirectory = child.node
				? ((child.node as T).is_dir ?? false)
				: true;
			nodes.push(
				AgentMessagesService.buildNode({
					name: segment,
					uri: child.node && !isDirectory ? (child.node as T).uri : undefined,
					directory: isDirectory,
					content: isDirectory
						? AgentMessagesService.buildTree({
								tree: child,
								depth: depth + 1,
								maxDepth: maxDepth - 1,
							})
						: undefined,
					depth,
				}),
			);
		}
		return nodes.join("\n");
	},

	buildNode: ({
		name,
		uri,
		directory,
		content,
		depth = 0,
	}: {
		name: string;
		uri?: string;
		directory?: boolean;
		content?: string;
		depth?: number;
	}) => {
		const type = directory ? "folder" : "file";
		return `${"  ".repeat(depth)}<${type} name="${name}"${uri ? ` path="${uri}"` : ""}${content ? `>\n${content}\n${"  ".repeat(depth)}</${type}>` : ` />`}`;
	},
};
