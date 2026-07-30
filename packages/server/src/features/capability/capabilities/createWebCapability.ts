import type {
	CapabilityFactory,
	WebCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { WebService } from "../../proxy/services/WebService.ts";

export const createWebCapability: CapabilityFactory<
	{ user: zUser },
	WebCapability
> = async ({ user }) => {
	return {
		search: async ({ query }) => {
			return await WebService.search({ user, query });
		},

		view: async ({ url }) => {
			return await WebService.view({ user, url });
		},
	};
};
