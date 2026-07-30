import type {
	CapabilityFactory,
	WebCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import { client } from "#ui/client.ts";

export const createWebCapability: CapabilityFactory<
	void,
	WebCapability
> = async () => {
	return {
		search: async ({ query, maxResults }) => {
			return await client.api.web.search.query({ query, maxResults });
		},
		view: async ({ url }) => {
			return await client.api.web.view.query({ url });
		},
	};
};
