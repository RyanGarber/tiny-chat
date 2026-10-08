import { useQuery } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useSession } from "#client/core/hooks/useSession.ts";
import { useStableKey } from "#client/core/hooks/useStableKey.ts";
import { ClientCapabilityService } from "#client/core/services/ClientCapabilityService.ts";
import { useProviders } from "#client/features/agent/hooks/useProviders.ts";
import { useChat } from "#client/features/chat/hooks/useChat.ts";
import { useMessages } from "#client/features/message/hooks/useMessages.ts";
import type { zAgentMessage } from "#core/features/agent/types/agent.ts";

/**
 * The capabilities of the message about to be sent, gated as if it had already
 * been saved: a chat and a prompt row will exist by the time it runs, so the
 * answer here is the one generation will get.
 *
 * `draft` is whatever is being written but not saved yet. It counts the same as
 * a saved message: the mount is built from what messages point into, so an
 * upload attached in the editor is readable — and so costs tokens — before it
 * has a chat to belong to.
 *
 * `future` skips the chat's own messages, for asking what is on offer in the
 * abstract rather than what this conversation adds up to.
 */
export const useCapabilities = ({
	future,
	draft,
}: {
	future: boolean;
	draft?: zAgentMessage[];
}) => {
	const client = useContext(ClientContext);

	const { session } = useSession();
	const { providers } = useProviders();
	const { nextChat } = useChat();

	// The history the chat renders, so what is counted is what is shown.
	const { messages } = useMessages();

	const sources = useMemo(
		(): zAgentMessage[] => [
			...((!future && messages.data?.messages) || []),
			...(draft ?? []),
		],
		[future, messages.data?.messages, draft],
	);

	const key = useStableKey({
		messages: sources,
		providers: providers.data,
		// Gating reads settings, and the folder's win over the user's.
		settings: session.data?.user.settings,
		chat: nextChat,
	});

	const capabilities = useQuery({
		queryKey: ["capabilities", session.data?.user.id, future, key],
		queryFn: async () => {
			if (!session.data) return {};
			return ClientCapabilityService.getCapabilities({
				client,
				user: session.data.user,
				chat: nextChat,
				message: future ? undefined : messages.data?.messages.at(-1),
				messages: sources,
				incognito: nextChat.incognito,
				temporary: nextChat.temporary,
				providers: providers.data,
				presumed: true,
			});
		},
	});

	return { capabilities, sourceMessages: messages };
};
