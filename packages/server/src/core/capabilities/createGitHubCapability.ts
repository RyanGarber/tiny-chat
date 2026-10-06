import type {
	CapabilityFactory,
	GitHubCapability,
} from "#core/core/types/capability.ts";
import type { zUser } from "#core/features/data/types/user.ts";
import { GitHubApiService } from "#server/features/proxy/services/GitHubApiService.ts";

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
