import type {
	CapabilityFactory,
	EmbeddingCapability,
} from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import { ModelProviderService } from "@tiny-chat/shared/src/features/provider/services/ModelProviderService.ts";
import { CommonUtils } from "#frontend/core/utils/CommonUtils.ts";
import { ProviderService } from "#frontend/features/config/services/ProviderService.ts";
import { trpc } from "#frontend/utils/api.ts";

export const createEmbeddingCapability: CapabilityFactory<
	{ user: zUser },
	EmbeddingCapability
> = async ({ user }) => ({
	getEmbedding: async ({ message }) => {
		return await trpc.embedding.getMessageEmbedding.query(message);
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
				env: CommonUtils.env,
			})
		)[0];
	},
});
