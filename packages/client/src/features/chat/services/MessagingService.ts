import type {
	MessageState,
	zData,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Client } from "../../../client.ts";
import { useConfigStore } from "../../agent/stores/useConfigStore.ts";
import type { AttachmentItem } from "../../editor/types/attachment.ts";
import { AttachmentUtils } from "../../editor/utils/AttachmentUtils.ts";
import { useDraftStore } from "../stores/useDraftStore.ts";
import { useMessagingStore } from "../stores/useMessagingStore.ts";

export interface ClientInput {
	getData: ({ client }: { client: Client }) => zData;
	setData: ({ client, data }: { client: Client; data: zData }) => void;
	/**
	 * Write an attachment into the editor wherever the cursor is, as whatever
	 * stands for one there — a node, or an atom in a plain text buffer.
	 *
	 * An attachment travels inside the message's text, so anything offering one
	 * from outside the editor — an upload finishing, a repository being picked —
	 * has to put it there rather than alongside.
	 */
	insertAttachment: ({
		client,
		item,
	}: {
		client: Client;
		item: AttachmentItem;
	}) => void;
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

	/**
	 * Attach an upload to the message being written, by referencing its
	 * directory on the chat mount. That reference is the whole of it: an upload
	 * is in a chat because a message points into it.
	 */
	attachUpload: ({
		client,
		upload,
	}: {
		client: Client;
		upload: { id: string; name: string };
	}) => {
		if (!client.input) throw new Error("missing client input");

		client.input.insertAttachment({
			client,
			item: AttachmentUtils.forUpload({ upload }),
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
		setTruncating(message !== null);

		MessagingService.setData({ client, data: message?.data ?? [] });

		const { setOverrideConfig } = useConfigStore.getState();

		if (message) setOverrideConfig(message.config);
		else setOverrideConfig(null);
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

		const { setOverrideConfig } = useConfigStore.getState();
		setOverrideConfig(null);

		MessagingService.setData({ client, data: [] });
	},
};
