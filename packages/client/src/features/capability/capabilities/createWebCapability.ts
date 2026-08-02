import type {
	CapabilityFactory,
	WebCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { Client } from "../../../client.ts";

export const createWebCapability: CapabilityFactory<
	{ client: Client },
	WebCapability
> = async ({ client }) => {
	return {
		search: async ({ query, maxResults }) => {
			return await client.api.web.search.query({ query, maxResults });
		},
		view: async ({ url }) => {
			return await client.api.web.view.query({ url });
		},
	};
};
