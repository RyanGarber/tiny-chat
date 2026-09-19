import type {
	ActionsCapability,
	CapabilityFactory,
} from "@tiny-chat/core/src/core/types/capability.ts";
import { CapabilityUtils } from "@tiny-chat/core/src/core/utils/CapabilityUtils.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ActionService } from "../../features/chat/services/ActionService.ts";

export const createActionsCapability: CapabilityFactory<
	{ user: zUser; message?: MessageLike | null },
	ActionsCapability
> = async ({ user, message }) => {
	/** An action belongs to the message that set it up. */
	const source = () => CapabilityUtils.require(message, "actions");

	return {
		getActions: async () => {
			return ActionService.getActions({ user });
		},

		updateAction: async ({ id, data, schedule, timezone }) => {
			return ActionService.updateAction({
				user,
				message: source(),
				id,
				data,
				schedule,
				timezone,
			});
		},

		deleteAction: async ({ id }) => {
			return ActionService.deleteAction({ user, id });
		},

		createAction: async ({ data, schedule, timezone }) => {
			return ActionService.createAction({
				user,
				message: source(),
				data,
				schedule,
				timezone,
			});
		},
	};
};
