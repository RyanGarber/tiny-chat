import { useQuery } from "@tanstack/react-query";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../client.ts";
import { useProviders } from "../../features/agent/hooks/useProviders.ts";
import { useChat } from "../../features/chat/hooks/useChat.ts";
import { useChatStore } from "../../features/chat/stores/useChatStore.ts";
import { ClientCapabilityService } from "../services/ClientCapabilityService.ts";
import { useSession } from "./useSession.ts";
import { useStableKey } from "./useStableKey.ts";

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
	const { chat, nextChat } = useChat();

	const branches = useChatStore((s) => s.branches);
	const messages = useQuery({
		...client.query.message.getMessages.queryOptions({
			chat: chat.data?.id,
			branches,
		}),
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
		enabled: !future,
	});

	const sources = useMemo(
		(): zAgentMessage[] => [
			...(messages.data?.messages ?? []),
			...(draft ?? []),
		],
		[messages.data?.messages, draft],
	);

	const key = useStableKey({
		messages: sources,
		providers: providers.data,
		// Gating reads settings, and the folder's win over the user's.
		config: session.data?.user.settings.subagentConfig,
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
				message: messages.data?.messages.at(-1),
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
