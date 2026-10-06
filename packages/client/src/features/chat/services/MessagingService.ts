import type { Client } from "#client/client.ts";
import { useConfigStore } from "#client/features/agent/stores/useConfigStore.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useDraftStore } from "#client/features/chat/stores/useDraftStore.ts";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.ts";
import { AttachmentService } from "#client/features/editor/services/AttachmentService.ts";
import type { AttachmentItem } from "#client/features/editor/types/attachment.ts";
import type { EditorNode } from "#client/features/editor/types/node.ts";
import { AttachmentUtils } from "#client/features/editor/utils/AttachmentUtils.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { zData } from "#core/features/data/types/part.ts";

export interface ClientInput {
	getData: ({ client }: { client: Client }) => zData;
	setData: ({ client, data }: { client: Client; data: zData }) => void;
	/**
	 * Write an attachment into the editor wherever the cursor is, as whatever
	 * stands for one there — a node, or an atom in a plain text buffer.
	 *
	 * Attachment nodes point at an already-built attachment part in the shared
	 * editor registry.
	 */
	insertNode: ({ client, node }: { client: Client; node: EditorNode }) => void;
}

export const MessagingService = {
	/**
	 * Reads the message being written back out of the editor, as `zData`, and
	 * keeps {@link useDraftStore} in step with it — the one place every reader
	 * of the current content, in either runtime, can trust.
	 */
	getData: ({ client }: { client: Client }): zData => {
		if (!client.input) throw new Error("missing client input");

		const data = client.input
			.getData({ client })
			.map((step) =>
				step.filter((part) => part.type !== "text" || part.value.length),
			);
		useDraftStore.getState().setData(data);
		return data;
	},

	setData: ({ client, data }: { client: Client; data: zData }) => {
		if (!client.input) throw new Error("missing client input");

		client.input.setData({ client, data });
		useDraftStore.getState().setData(data);
	},

	insertAttachment: async ({
		client,
		item,
	}: {
		client: Client;
		item: AttachmentItem;
	}) => {
		if (!client.input) throw new Error("missing client input");
		const node = await AttachmentService.create({ client, item });
		client.input.insertNode({ client, node });
	},

	/**
	 * Attach an upload to the message being written, by referencing its
	 * directory on the chat mount. That reference is the whole of it: an upload
	 * is in a chat because a message points into it.
	 */
	attachUpload: async ({
		client,
		upload,
		file,
	}: {
		client: Client;
		upload: { id: string; name: string };
		file?: string;
	}) => {
		if (!client.input) throw new Error("missing client input");

		await MessagingService.insertAttachment({
			client,
			item: AttachmentUtils.forUpload({ upload, file }),
		});
	},

	setEditing: ({
		client,
		message,
	}: {
		client: Client;
		message: MessageState | null;
	}) => {
		const { setEditing, setTruncating, setInsertingAfter } =
			useMessagingStore.getState();

		if (message) setInsertingAfter(null);

		setEditing(message);
		setTruncating(message === null);

		MessagingService.setData({ client, data: message?.data ?? [] });

		// Editing adopts the message's config; cancelling restores the chat's.
		const { setOverrideConfig, setSyncChatId } = useConfigStore.getState();

		if (message) setOverrideConfig(message.config);
		else setSyncChatId(useChatStore.getState().chatId);
	},

	setTruncating: ({ truncating }: { truncating: boolean }) => {
		const { setTruncating } = useMessagingStore.getState();
		setTruncating(truncating);
	},

	setInsertingAfter: ({ message }: { message: MessageState | null }) => {
		const { editing, setEditing, setInsertingAfter } =
			useMessagingStore.getState();

		if (message && editing) setEditing(null);

		setInsertingAfter(message);
	},

	reset: ({ client }: { client: Client }) => {
		const { setEditing, setTruncating, setInsertingAfter } =
			useMessagingStore.getState();

		setTruncating(false);
		setEditing(null);
		setInsertingAfter(null);

		MessagingService.setData({ client, data: [] });
	},
};
