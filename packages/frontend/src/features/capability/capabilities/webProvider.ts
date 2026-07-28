import type {
	CapabilityFactory,
	WebProviderCapability,
} from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import { trpc } from "#frontend/utils/api.ts";

export const webProvider: CapabilityFactory<
	void,
	WebProviderCapability
> = async () => {
	return {
		search: async ({ query, maxResults }) => {
			return await trpc.web.search.query({ query, maxResults });
		},
		view: async ({ url }) => {
			return await trpc.web.view.query({ url });
		},
	};
};
