import type {
	MessageState,
	zData,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Client } from "../../../client.ts";
import { useConfigStore } from "../../agent/stores/useConfigStore.ts";
import { useMessagingStore } from "../stores/useMessagingStore.ts";

export interface ClientInput {
	getData: ({ client }: { client: Client }) => zData;
	setData: ({ client, data }: { client: Client; data: zData }) => void;
}

export const MessagingService = {
	getData: ({ client }: { client: Client }): zData => {
		if (!client.input) throw new Error("missing client input");

		const { attachments } = useMessagingStore.getState();

		const data = client.input
			.getData({ client })
			.map((step) =>
				step.filter((part) => part.type !== "text" || part.value.length),
			);

		return [attachments, ...data];
	},

	setData: ({ client, data }: { client: Client; data: zData }) => {
		if (!client.input) throw new Error("missing client input");

		const { setAttachments } = useMessagingStore.getState();
		setAttachments(data.flat().filter((p) => p.type === "upload"));

		client.input.setData({ client, data });
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
		const { editing, setEditing, setAttachments } =
			useMessagingStore.getState();

		if (message && editing) setEditing(null);

		setAttachments([]);
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
