import type { zAgentChat } from "../../features/agent/types/agent.ts";
import type { zUser } from "../../features/data/types/user.ts";
import { WebProviderService } from "../../features/provider/services/WebProviderService.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "../../features/provider/types/provider.ts";
import type { zWebFeature } from "../../features/provider/types/web.ts";
import { ProviderUtils } from "../../features/provider/utils/ProviderUtils.ts";
import type { Capabilities } from "../types/capability.ts";
import { SettingsUtils } from "./SettingsUtils.ts";

export type CapabilityName = keyof Capabilities;

/** Which capabilities a message is entitled to, whether or not they are built. */
export type CapabilitySet = Record<CapabilityName, boolean>;

/**
 * What a message's capabilities are decided from — facts about the message and
 * the host, never the capability objects themselves.
 *
 * `chat` and `message` mean "there is a row for this, or there will be by the
 * time the message runs", which is what lets an unsent message be costed with
 * the capabilities it is actually going to have.
 */
export interface CapabilityConditions {
	user: zUser;
	providers: ProviderState<ProviderStatus>[];
	/** The folder of the chat the message runs in; its settings win over the user's. */
	folder?: zAgentChat["folder"];
	chat: boolean;
	message: boolean;
	incognito: boolean | undefined;
	temporary: boolean | undefined;
	/** Whether the host can reach the user's own machine. */
	desktop: boolean;
}

export const CapabilityUtils = {
	/**
	 * The one answer to "what may this message do", shared by the server worker,
	 * the client, and the client asking what a message will cost before it is
	 * sent. Hosts build what they can of it and leave out the rest.
	 */
	getEnabled: ({
		user,
		providers,
		folder,
		chat,
		message,
		incognito,
		temporary,
		desktop,
	}: CapabilityConditions): CapabilitySet => {
		const settings = SettingsUtils.of(user, folder);

		// Incognito and temporary chats leave nothing behind, so nothing that
		// writes back to the user is offered to them.
		const personal = !incognito && !temporary;

		return {
			chatShell: true,
			github: true,
			shell: desktop,
			actions: personal && message,
			memories: personal,
			web: (["search", "view"] satisfies zWebFeature[]).some(
				(feature) =>
					!!WebProviderService.getBestProvider({ user, providers, feature }),
			),
			embedding: !!ProviderUtils.isValid(providers, settings.embeddingConfig),
			subagents:
				chat &&
				message &&
				!!ProviderUtils.isValid(providers, settings.subagentConfig),
		};
	},

	/**
	 * Unwrap a row a capability acts through. A capability enabled for a message
	 * that is not saved yet is still built — that is how the message gets costed
	 * — but it has nothing to write to, and this is what it says if it is ever
	 * asked to.
	 */
	require: <T>(
		value: T | null | undefined,
		capability: CapabilityName,
	): NonNullable<T> => {
		if (value === null || value === undefined) {
			throw new Error(
				`The ${capability} capability cannot be used until the chat and message are saved`,
			);
		}
		return value;
	},
} as const;
