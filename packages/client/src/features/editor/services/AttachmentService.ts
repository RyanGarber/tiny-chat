import { AttachmentService as CoreAttachmentService } from "@tiny-chat/core/src/features/file/services/AttachmentService.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { Client } from "../../../client.ts";
import { createChatShellCapability } from "../../../core/capabilities/createChatShellCapability.ts";
import { useMarkdownDataStore } from "../../message/stores/useMarkdownDataStore.ts";
import type { AttachmentItem } from "../types/attachment.ts";
import type { EditorNode } from "../types/node.ts";

export const AttachmentService = {
	create: async ({
		client,
		item,
	}: {
		client: Client;
		item: AttachmentItem;
	}): Promise<Extract<EditorNode, { type: "attachment" }>> => {
		const source = item.value;
		const mounted = PathUtils.fromMount({ path: source });
		const shell =
			mounted?.mount && mounted.id
				? await createChatShellCapability({
						client,
						...(mounted.mount === "chat" ? { chat: mounted.id } : {}),
						...(mounted.mount === "uploads" ? { uploads: [mounted.id] } : {}),
						...(mounted.mount === "skills" ? { skills: [mounted.id] } : {}),
					})
				: client.shell;

		const attachment = await CoreAttachmentService.build({
			source,
			label: item.label ?? item.name,
			directory: item.directory,
			shell,
			web: {
				view: async ({ url }) => await client.api.web.view.query({ url }),
			},
		});
		useMarkdownDataStore.getState().addAttachment(attachment);
		return { type: "attachment", id: attachment.id };
	},
} as const;
