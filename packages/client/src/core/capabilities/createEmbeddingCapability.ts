import type { Client } from "#client/client.ts";
import { ClientProviderService } from "#client/features/agent/services/ClientProviderService.ts";
import type {
	CapabilityFactory,
	EmbeddingCapability,
} from "#core/core/types/capability.ts";
import type { zUser } from "#core/features/data/types/user.ts";
import { ModelProviderService } from "#core/features/provider/services/ModelProviderService.ts";

export const createEmbeddingCapability: CapabilityFactory<
	{ client: Client; user: zUser },
	EmbeddingCapability
> = async ({ client, user }) => ({
	getEmbedding: async ({ message }) => {
		return await client.api.embedding.getMessageEmbedding.query(message);
	},

	runEmbedding: async ({ text }) => {
		const config = user.settings.embeddingConfig;
		if (!config) throw new Error("missing embedding config");

		const provider = (
			await ClientProviderService.getModelProviders({ client, user })
		).find((provider) => provider.name === config?.provider);
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
