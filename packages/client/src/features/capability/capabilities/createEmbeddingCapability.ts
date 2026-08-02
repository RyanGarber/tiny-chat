import type {
	CapabilityFactory,
	EmbeddingCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import type { Client } from "../../../client.ts";
import { ProviderService } from "../../agent/services/ProviderService.ts";

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
			await ProviderService.getModelProviders({ client, user })
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
