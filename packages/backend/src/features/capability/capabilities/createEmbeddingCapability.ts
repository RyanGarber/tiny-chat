import type {
	CapabilityFactory,
	EmbeddingCapability,
} from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import { ModelProviderService } from "@tiny-chat/shared/src/features/provider/services/ModelProviderService.ts";
import { EmbeddingService } from "../../embedding/services/EmbeddingService.ts";

export const createEmbeddingCapability: CapabilityFactory<
	{ user: zUser },
	EmbeddingCapability
> = async ({ user }) => {
	return {
		getEmbedding: async ({ message }) => {
			return await EmbeddingService.getMessageEmbedding({ user, message });
		},

		runEmbedding: async ({ text }) => {
			const config = user.settings.embeddingConfig;
			if (!config) throw new Error("missing embedding config");

			const provider = ModelProviderService.providers.find(
				(provider) => provider.name === config.provider,
			);
			if (!provider) throw new Error("missing embedding provider");

			return (
				await ModelProviderService.runEmbeddingModel({
					user,
					provider,
					config,
					values: [text],
					env: {},
				})
			)[0];
		},
	};
};
