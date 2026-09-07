import type { Capabilities } from "@tiny-chat/core/src/core/types/capability.ts";
import type { MaybeNullish } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { WebProviderService } from "@tiny-chat/core/src/features/provider/services/WebProviderService.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zWebFeature } from "@tiny-chat/core/src/features/provider/types/web.ts";
import { ProviderUtils } from "@tiny-chat/core/src/features/provider/utils/ProviderUtils.ts";
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import type { Client } from "../../client.ts";
import { ClientProviderService } from "../../features/agent/services/ClientProviderService.ts";
import { createActionsCapability } from "../capabilities/createActionsCapability.ts";
import { createChatShellCapability } from "../capabilities/createChatShellCapability.ts";
import { createEmbeddingCapability } from "../capabilities/createEmbeddingCapability.ts";
import { createMemoriesCapability } from "../capabilities/createMemoriesCapability.ts";
import { createShellCapability } from "../capabilities/createShellCapability.ts";
import { createSubagentsCapability } from "../capabilities/createSubagentsCapability.ts";
import { createWebCapability } from "../capabilities/createWebCapability.ts";

const unpresume = <
	TIn extends { id: string } | null | undefined,
	TOut extends { id: string },
>(
	value: TIn,
): MaybeNullish<TIn, TOut> => {
	return (value as any)?.id !== "any"
		? (value as unknown as MaybeNullish<TIn, TOut>)
		: (null as MaybeNullish<TIn, TOut>);
};

export const ClientCapabilityService = {
	getCapabilities: async ({
		client,
		user,
		chat,
		message,
		messages,
		incognito,
		temporary,
		providers,
		skills = [],
		mcpTools = [],
	}: {
		client: Client;
		user: zUser;
		chat: ChatState | null | undefined;
		message: MessageState | null | undefined;
		/** What the mount is built from; a chat only adds somewhere to write. */
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		temporary: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
		skills?: zSkill[];
		mcpTools?: Toolset<any>[];
	}): Promise<Capabilities> => {
		const capabilities: Capabilities = {};

		if (message?.id && !incognito && !temporary) {
			capabilities.actions = await createActionsCapability({
				client,
				message: unpresume(message),
			});
		}

		if (!incognito && !temporary) {
			capabilities.memories = await createMemoriesCapability({
				client,
				message: unpresume(message),
			});
		}

		capabilities.chatShell = await createChatShellCapability({
			client,
			chat: unpresume(chat)?.id,
			...AgentUtils.getMounts({ messages: messages ?? [] }),
		});

		if (client.desktop) {
			capabilities.shell = await createShellCapability({ client });
		}

		providers ??= await ClientProviderService.getProviderStates({
			client,
			user,
		});

		if (ProviderUtils.isValid(providers, user.settings.embeddingConfig)) {
			capabilities.embedding = await createEmbeddingCapability({
				client,
				user,
			});
		}
		if (
			chat?.id &&
			message?.id &&
			ProviderUtils.isValid(providers, user.settings.subagentConfig)
		) {
			capabilities.subagents = await createSubagentsCapability({
				client,
				chat: unpresume(chat),
				message: unpresume(message),
				providers,
				skills,
				mcpTools,
			});
		}

		const web = (["search", "view"] satisfies zWebFeature[]).some(
			(feature) =>
				!!WebProviderService.getBestProvider({
					user,
					providers,
					feature,
				}),
		);
		if (web) {
			capabilities.web = await createWebCapability({ client });
		}

		return capabilities;
	},

	/**
	 * The capabilities a message *would* have, for working out what a chat costs
	 * before anything is sent. `true` stands for "there will be one of these by
	 * then" where the real thing does not exist yet.
	 */
	getPresumedCapabilities: async ({
		client,
		user,
		chat,
		message,
		messages,
		incognito,
		temporary,
		providers,
	}: {
		client: Client;
		user: zUser;
		chat: ChatState | boolean | null;
		message: MessageState | boolean | null;
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		temporary: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}) => {
		if (typeof chat === "boolean") {
			chat = chat ? ({ id: "any" } as unknown as ChatState) : null;
		}
		if (typeof message === "boolean") {
			message = message ? ({ id: "any" } as unknown as MessageState) : null;
		}
		return await ClientCapabilityService.getCapabilities({
			client,
			user,
			chat,
			message,
			messages,
			incognito,
			temporary,
			providers,
		});
	},
} as const;
