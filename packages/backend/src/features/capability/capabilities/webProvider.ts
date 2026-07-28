import type {
	CapabilityFactory,
	WebProviderCapability,
} from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import { WebService } from "../../proxy/services/WebService.ts";

export const webProvider: CapabilityFactory<
	{ user: zUser },
	WebProviderCapability
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
