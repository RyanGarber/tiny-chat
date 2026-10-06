import type { Client } from "#client/client.ts";
import type {
	CapabilityFactory,
	GitHubCapability,
} from "#core/core/types/capability.ts";

export const createGitHubCapability: CapabilityFactory<
	{ client: Client; preferLinkedAccount: boolean },
	GitHubCapability
> = async ({ client, preferLinkedAccount }) => ({
	request: async ({ path, query }) => {
		return await client.api.github.request.query({
			path,
			query,
			preferLinkedAccount,
		});
	},
});
