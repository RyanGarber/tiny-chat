import type {
	CapabilityFactory,
	GitHubCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { Client } from "../../client.ts";

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
