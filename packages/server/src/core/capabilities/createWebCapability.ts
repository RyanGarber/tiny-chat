import type {
	CapabilityFactory,
	WebCapability,
} from "#core/core/types/capability.ts";
import type { zUser } from "#core/features/data/types/user.ts";
import { WebService } from "#server/features/proxy/services/WebService.ts";

export const createWebCapability: CapabilityFactory<
	{ user: zUser },
	WebCapability
> = async ({ user }) => {
	return {
		search: async ({ query, maxResults }) => {
			return await WebService.search({ user, query, maxResults });
		},

		view: async ({ url }) => {
			return await WebService.view({ user, url });
		},
	};
};
