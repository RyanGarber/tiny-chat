import { useQuery } from "@tanstack/react-query";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../client.ts";
import { ClientCapabilityService } from "../../core/services/ClientCapabilityService.ts";
import { useProviders } from "../../features/agent/hooks/useProviders.ts";
import { useChat } from "../../features/chat/hooks/useChat.ts";
import { useChatStore } from "../../features/chat/stores/useChatStore.ts";
import { useSession } from "../hooks/useSession.ts";

/**
 * The capabilities of the message about to be sent.
 *
 * `draft` is whatever is being written but not saved yet. It counts the same as
 * a saved message: the mount is built from what messages point into, so an
 * upload attached in the editor is readable — and so costs tokens — before it
 * has a chat to belong to.
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
	const { chat } = useChat();

	// TODO - use smaller subset of message data
	const messages = useQuery({
		...client.query.message.getMessages.queryOptions({ chat: chat.data?.id }),
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
		enabled: !future,
	});

	const createIncognito = useChatStore((s) => s.createIncognito);

	const sources = useMemo(
		(): zAgentMessage[] => [
			...(messages.data?.messages ?? []),
			...(draft ?? []),
		],
		[messages.data?.messages, draft],
	);

	const presumedCapabilities = useQuery({
		queryKey: [
			"capabilities",
			session.data?.user.id,
			providers.data
				?.map((provider) => `${provider.name}:${provider.status}`)
				.join(),
			createIncognito,
			chat.data?.id,
			messages.data?.messages.at(-1)?.id,
			draft,
			future,
		],
		queryFn: async () => {
			if (!session.data) return {};
			return ClientCapabilityService.getPresumedCapabilities({
				client,
				user: session.data.user,
				chat: future ? true : (chat.data ?? null), // TODO
				message: future ? true : (messages.data?.messages.at(-1) ?? true),
				messages: sources,
				incognito: chat.data?.incognito ?? createIncognito,
				providers: providers.data,
			});
		},
	});

	return { presumedCapabilities, sourceMessages: messages };
};
