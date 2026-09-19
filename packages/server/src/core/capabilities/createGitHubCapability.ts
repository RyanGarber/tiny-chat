import type {
	CapabilityFactory,
	GitHubCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { GitHubApiService } from "../../features/proxy/services/GitHubApiService.ts";

export const createGitHubCapability: CapabilityFactory<
	{ user: zUser; preferLinkedAccount: boolean },
	GitHubCapability
> = async ({ user, preferLinkedAccount }) => ({
	request: async ({ path, query }) => {
		return await GitHubApiService.request({
			user,
			path,
			query,
			preferLinkedAccount,
		});
	},
});
