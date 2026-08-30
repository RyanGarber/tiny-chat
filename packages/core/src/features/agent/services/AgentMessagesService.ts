import type {
	Capabilities,
	ShellCapability,
} from "../../../core/types/capability.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { VERBOSE } from "../../../logger.ts";
import { Author, type zDataPart } from "../../data/types/message.ts";
import { DirectiveUtils } from "../../data/utils/DirectiveUtils.ts";
import { FileOperationService } from "../../file/services/FileOperationService.ts";
import { FileTypeUtils } from "../../file/utils/FileTypeUtils.ts";
import { type Descendent, FileUtils } from "../../file/utils/FileUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zAgentContext, zAgentMessage } from "../types/agent.ts";

export const AgentMessagesService = {
	buildMessages: async ({
		context,
		capabilities,
	}: {
		context: zAgentContext;
		capabilities: Capabilities;
	}): Promise<{ messages: zAgentMessage[]; customInstructions?: string }> => {
		const messages: zAgentMessage[] = [];
		let customInstructions: string | undefined;

		for (let i = 0; i < context.messages.length; i++) {
			const message = context.messages[i];
			const previous = context.messages[i - 1];

			const parts: zDataPart[] = message.data.flat();
			const transformedParts: zDataPart[] = [];

			for (const part of parts) {
				if (part.type === "text") {
					const directives = DirectiveUtils.extractFromMarkdown(
						part.value,
						"command",
						"quote",
						// Keep the synthesized skill attachment typed below without
						// recognizing persisted attachment directives at runtime.
						...([] as "attachment"[]),
					);
					for (const { text, directive } of directives) {
						// convert skill command to attached SKILL.md
						if (
							directive?.tag === "command" &&
							directive.attributes.value?.startsWith("skill:")
						) {
							directive.tag = "attachment";
							directive.attributes = {
								source: directive.attributes.value.slice(6),
								"is-directory": "false",
							};
						}

						if (directive?.tag === "quote") {
							transformedParts.push({
								id: part.id,
								type: "text",
								value: DirectiveUtils.convertToHtml(
									[{ text, directive }],
									"quote",
								),
							});
						} else if (directive?.tag === "command") {
							if (directive.attributes.name === "system-prompt") {
								customInstructions = directive.textContent;
								console.log(
									"[AgentMessagesService] using custom instructions:",
									directive.textContent,
								);
							} else {
								console.warn(
									"[AgentMessagesService] ignoring unknown command:",
									directive.attributes.name,
									":",
									text,
								);
								transformedParts.push({ ...part, value: text });
							}
						} else if (directive?.tag === "attachment") {
							let attachment: zDataPart | undefined;
							try {
								const chat = !!PathUtils.fromMount({
									path: directive.attributes.source,
								});
								const shell = chat
									? capabilities.chatShell
									: capabilities.shell;
								if (directive.attributes.source?.startsWith("web:")) {
									const web = await capabilities.web?.view({
										url: directive.attributes.source.slice(4),
									});
									if (web) {
										attachment = {
											id: part.id,
											type: "text",
											value: web.content,
										};
									}
								} else if (directive.attributes["is-directory"] === "true") {
									const xml = await AgentMessagesService.buildDirectoryBlock({
										shell,
										path: directive.attributes.source,
									});
									if (xml) {
										attachment = {
											id: part.id,
											type: "text",
											value: xml,
										};
									}
								} else {
									const file = await shell?.readFile({
										path: directive.attributes.source,
									});
									if (file) {
										attachment = {
											id: CommonUtils.getRandomId(),
											type: "file",
											name: PathUtils.name(file),
											data: FileUtils.getBase64FromBytes(file),
											mime:
												(await FileTypeUtils.getMime(file)) ??
												"application/octet-stream",
										};
									}
								}
							} catch (error: any) {
								console.error(
									"[AgentMessagesService] error reading attachment:",
									error,
								);
							}
							// An upload is mounted under its id, which says nothing about
							// what it holds, so the name it was attached under is carried
							// through to stand in for the path.
							const name = directive.attributes.name
								? ` name="${directive.attributes.name}"`
								: "";

							transformedParts.push(
								{
									...part,
									id: CommonUtils.getRandomId(),
									value: `<attachment source="${PathUtils.normalize({ path: directive.attributes.source })}"${name}>`,
								},
								attachment ?? {
									id: part.id,
									type: "text",
									value: "<!-- content unavailable -->",
								},
								{
									...part,
									id: CommonUtils.getRandomId(),
									value: "</attachment>",
								},
							);
						} else {
							transformedParts.push({ ...part, value: text });
						}
					}
				} else if (part.type === "attachment") {
					transformedParts.push(
						...AgentMessagesService.buildAttachmentParts(part),
					);
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
				}),
			);
		}

		if (VERBOSE)
			console.log("[AgentMessagesService] built messages:", messages);

		return { messages, customInstructions };
	},

	buildAttachmentParts: (
		attachment: Extract<zDataPart, { type: "attachment" }>,
	): zDataPart[] => {
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
	}: {
		message: zAgentMessage;
		previous?: zAgentMessage;
		parts: zDataPart[];
		timezone?: string;
	}): zAgentMessage => {
		const attributes = {
			role: message.author === Author.USER ? "user" : "assistant",
		} as Record<string, string>;

		if (message.author === Author.MODEL) {
			const model = message.config?.model;
			if (model) attributes.model = model;
		}

		if (message.createdAt) {
			attributes.sent = CommonUtils.formatDate({
				date: message.createdAt,
				timezone,
			});
			if (previous?.createdAt && message.author === Author.USER) {
				attributes.gap = CommonUtils.formatTimespan({
					from: previous.createdAt,
					to: message.createdAt,
				});
			}
		}

		return {
			...message,
			data: [
				[
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
	}: {
		tree: Descendent<T>;
		depth?: number;
	}): string => {
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
						? AgentMessagesService.buildTree({ tree: child, depth: depth + 1 })
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
