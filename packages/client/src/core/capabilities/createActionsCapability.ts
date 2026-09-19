import type {
	ActionsCapability,
	CapabilityFactory,
} from "@tiny-chat/core/src/core/types/capability.ts";
import { CapabilityUtils } from "@tiny-chat/core/src/core/utils/CapabilityUtils.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Client } from "../../client.ts";

export const createActionsCapability: CapabilityFactory<
	{ client: Client; message?: MessageLike | null },
	ActionsCapability
> = async ({ client, message }) => {
	/** An action belongs to the message that set it up. */
	const source = () => CapabilityUtils.require(message, "actions");

	return {
		getActions: async () => {
			return await client.api.action.getActions.query();
		},

		createAction: async ({ data, schedule, timezone }) => {
			return await client.api.action.createAction.mutate({
				message: source(),
				data,
				schedule,
				timezone,
			});
		},

		updateAction: async ({ id, data, schedule, timezone }) => {
			return await client.api.action.updateAction.mutate({
				id,
				message: source(),
				data,
				schedule,
				timezone,
			});
		},

		deleteAction: async ({ id }) => {
			return await client.api.action.deleteAction.mutate({ id });
		},
	};
};
