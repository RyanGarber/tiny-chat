import { format } from "timeago.js";
import type { zChat } from "../../types/chat.ts";
import {
	Author,
	type zContextItem,
	type zData,
	type zDataPart,
	type zGenerateInput,
} from "../../types/chat.ts";
import type { zSkill } from "../../types/skill.ts";
import type { zToolGroup } from "../../types/tool.ts";
import type { zUser } from "../../types/user.ts";
import { toChatUri } from "../../utils/files.ts";
import { directiveToXml } from "../../utils/text.ts";
import type { GenerationCallbacks } from "./generate.ts";
import {
	buildGenerationInstructions,
	formatLocalDate,
} from "./instructions.ts";

export async function buildContext(
	user: zUser,
	chat: zChat | null,
	input: zGenerateInput,
	toolGroups: zToolGroup[],
	skills: zSkill[],
	callbacks: GenerationCallbacks,
) {
	const files = await callbacks.listFilesInChat(chat?.id);
	console.log(`[context] files in chat:`, files);

	const context: zContextItem[] = input.context.map((m, i) => {
		const previous = input.context[i - 1];

		return buildMessageTree(
			m,
			previous,
			m.data.map((d) =>
				d.flatMap((p): zDataPart[] => {
					if (p.type === "upload") {
						console.log(
							`[context] transforming upload '${p.name}' with ${files[p.id]?.length ?? 0} file(s)`,
						);
						if (files[p.id]?.length) {
							const xml = buildFileTree(p, files[p.id]);
							console.log("[context] upload tree:", xml);
							return [
								{
									type: "text",
									value: xml,
								},
							];
						}
					}
					if (p.type === "text") {
						return [{ ...p, value: directiveToXml(p.value, ["quote"]) }];
					}
					return [p];
				}),
			),
			input.timezone,
		);
	});

	console.log("[context] final context:", context);

	const instructions = await buildGenerationInstructions(
		user,
		callbacks,
		input,
		context,
		toolGroups,
		skills,
	);

	console.log("[context] final instructions:", instructions);

	return { context, instructions };
}

export function buildMessageTree(
	message: zContextItem,
	previous: zContextItem | undefined,
	data: zData,
	timezone?: string,
): zContextItem {
	const attributes = {
		role: message.author === Author.USER ? "user" : "assistant",
	} as Record<string, string>;

	if (message.author === Author.MODEL) {
		const model = message.config?.model;
		if (model) attributes.model = model;
	}

	if (message.createdAt) {
		attributes.sent = formatLocalDate(message.createdAt, timezone);
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
			],
			...data,
			[{ type: "text", value: "</message>" }],
		],
	};
}

export function buildFileTree(
	upload: { id: string; name: string },
	files: { path: string[] }[],
) {
	const tree: Record<string, unknown> = {};

	for (const file of files) {
		const path = file.path.filter((part) => part.length);
		if (path.length === 0) continue;
		let node = tree;
		for (let i = 0; i < path.length - 1; i++) {
			const segment = path[i];
			node[segment] ??= {};
			node = node[segment] as Record<string, unknown>;
		}
		const filename = path[path.length - 1];
		node[filename] = null; // leaf = file
	}

	const renderTree = (
		node: Record<string, unknown>,
		prefix: string[] = [],
	): string => {
		const entries = Object.entries(node);
		return entries
			.flatMap(([name, children]) => {
				const uri = toChatUri(upload.id, [...prefix, name]);
				if (!name.length) return [];
				if (children === null) {
					return `${"  ".repeat(prefix.length + 1)}<file name="${name}" path="${uri}" />`;
				}
				const subtree = renderTree(children as Record<string, unknown>, [
					...prefix,
					name,
				]);
				return `${"  ".repeat(prefix.length + 1)}<folder name="${name}">\n${subtree}\n${"  ".repeat(prefix.length + 1)}</folder>`;
			})
			.join("\n");
	};

	return `<attachment name="${upload.name}" path="${toChatUri(upload.id)}">\n${renderTree(tree)}\n</attachment>`;
}
