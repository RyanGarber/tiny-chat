import { format } from "timeago.js";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type { Capabilities } from "../../capability/types/capability.ts";
import { Author, type zDataPart } from "../../data/types/message.ts";
import { DirectiveUtils } from "../../data/utils/DirectiveUtils.ts";
import { FileTypeUtils } from "../../file/utils/FileTypeUtils.ts";
import { type Descendent, FileUtils } from "../../file/utils/FileUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zAgentContext, zAgentMessage } from "../types/agent.ts";
import { AgentUtils } from "../utils/AgentUtils.ts";

export const AgentMessagesService = {
	buildMessages: async ({
		context,
		capabilities,
	}: {
		context: zAgentContext;
		capabilities: Capabilities;
	}): Promise<{ messages: zAgentMessage[]; customInstructions?: string }> => {
		const files = await capabilities.chatShell?.getFiles?.();
		console.log(`[AgentMessagesService] files in chat:`, files);

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
						"attachment",
						"quote",
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
								type: "text",
								value: DirectiveUtils.convertToHtml(
									[{ text, directive }],
									"quote",
								),
							});
						} else if (directive?.tag === "command") {
							if (directive.attributes.name === "system-prompt") {
								const { index } = AgentUtils.getLastPrompt(context);
								if (i === index) customInstructions = directive.textContent;
								console.log(
									"[AgentMessagesService] using custom instructions:",
									text,
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
											type: "text",
											value: web.content,
										};
									}
								} else if (directive.attributes["is-directory"] === "true") {
									const directory = await shell?.readDir({
										path: directive.attributes.source,
									});
									if (directory) {
										attachment = {
											type: "text",
											value: directory
												.map((node) =>
													AgentMessagesService.buildNode({
														name: PathUtils.name(node),
														directory: node.is_dir,
													}),
												)
												.join("\n"),
										};
									}
								} else {
									const file = await shell?.readFile({
										path: directive.attributes.source,
									});
									if (file) {
										attachment = {
											type: "file",
											name: PathUtils.name(file),
											data: FileUtils.getBase64FromBytes(file),
											mime:
												(await FileTypeUtils.getMime(file)) ??
												"application/octet-stream",
										};
									}
								}
							} catch (e: any) {
								console.error(
									"[AgentMessagesService] error reading attachment:",
									e,
								);
							}
							transformedParts.push(
								{
									...part,
									value: `<attachment source="${PathUtils.normalize({ path: directive.attributes.source })}">`,
								},
								attachment ?? {
									type: "text",
									value: "<!-- content unavailable -->",
								},
								{ ...part, value: "</attachment>" },
							);
						} else {
							transformedParts.push({ ...part, value: text });
						}
					}
				} else if (part.type === "upload") {
					if (!files)
						throw new Error(
							"failed to get files for upload part (was the chatShell capability provided?)",
						);
					const uploadFiles = files.filter((file) => file.uploadId === part.id);
					console.log(
						`[AgentMessagesService] transforming upload '${part.name}' with ${uploadFiles.length ?? 0} file(s)`,
					);
					if (uploadFiles.length) {
						const xml = AgentMessagesService.buildUploadBlock({
							upload: part,
							files: uploadFiles,
						});
						console.log("[AgentMessagesService] upload tree:", xml);
						transformedParts.push({
							type: "text",
							value: xml,
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
				}),
			);
		}

		console.log("[AgentMessagesService] built messages:", messages);

		return { messages, customInstructions };
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
			attributes.sent = CommonUtils.getDateFormatted({
				date: message.createdAt,
				timezone,
			});
		}

		if (message.author === Author.USER) {
			const after =
				message.createdAt && previous?.createdAt
					? format(previous.createdAt, undefined, {
							relativeDate: message.createdAt,
						}).replace(" ago", "")
					: null;
			if (after) attributes.gap = after;
		}

		return {
			...message,
			data: [
				[
					{
						type: "text",
						value: `<message${Object.entries(attributes)
							.map(([k, v]) => ` ${k}="${v}"`)
							.join("")}>`,
					},
					...parts,
					{ type: "text", value: "</message>" },
				],
			],
		};
	},

	buildUploadBlock: ({
		upload,
		files,
	}: {
		upload: { id: string; name: string };
		files: { uri: string; path: string[] }[];
	}) => {
		const tree = FileUtils.toTree({
			nodes: files.map((file) => ({ ...file, path: file.path.slice(1) })),
		});

		const buildNodes = (
			descendent: Descendent<(typeof files)[number]>,
			depth = 0,
		): string => {
			const nodes: string[] = [];
			for (const [segment, child] of descendent.children) {
				nodes.push(
					AgentMessagesService.buildNode({
						name: segment,
						uri: child.node ? child.node.uri : undefined,
						directory: !child.node,
						content: !child.node ? buildNodes(child, depth + 1) : undefined,
						depth: depth + 1,
					}),
				);
			}
			return nodes.join("\n");
		};

		return `<upload name="${upload.name}" path="${PathUtils.toMount({ uploadId: upload.id })}">\n${buildNodes(tree)}\n</upload>`;
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
		return `${"  ".repeat(depth + 1)}<${type} name="${name}"${uri ? ` path="${uri}"` : ""}${content ? `>\n${content}\n${"  ".repeat(depth + 1)}</${type}>` : ` />`}`;
	},
};
