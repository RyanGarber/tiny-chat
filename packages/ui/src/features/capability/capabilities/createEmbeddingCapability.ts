import type {
	CapabilityFactory,
	EmbeddingCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import { client } from "#ui/client.ts";
import { ProviderService } from "#ui/features/config/services/ProviderService.ts";

export const createEmbeddingCapability: CapabilityFactory<
	{ user: zUser },
	EmbeddingCapability
> = async ({ user }) => ({
	getEmbedding: async ({ message }) => {
		return await client.api.embedding.getMessageEmbedding.query(message);
	},

	runEmbedding: async ({ text }) => {
		const config = user.settings.embeddingConfig;
		if (!config) throw new Error("missing embedding config");

		const provider = (await ProviderService.getModelProviders(user)).find(
			(p) => p.name === config?.provider,
		);
		if (!provider) throw new Error("missing embedding provider");

		return (
			await ModelProviderService.runEmbeddingModel({
				user,
				provider,
				values: [text],
				config,
				env: client.providerEnv,
			})
		)[0];
	},
});
