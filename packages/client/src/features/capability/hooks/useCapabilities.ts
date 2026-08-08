import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useChat } from "../../chat/hooks/useChat.ts";
import { useChatStore } from "../../chat/stores/useChatStore.ts";
import { ClientCapabilityService } from "../services/ClientCapabilityService.ts";

export const useCapabilities = ({ future }: { future: boolean }) => {
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
			future,
		],
		queryFn: async () => {
			if (!session.data) return {};
			return ClientCapabilityService.getPresumedCapabilities({
				client,
				user: session.data.user,
				chat: future ? true : (chat.data ?? null), // TODO
				message: future ? true : (messages.data?.messages.at(-1) ?? true),
				incognito: chat.data?.incognito ?? createIncognito,
				providers: providers.data,
			});
		},
	});

	return { presumedCapabilities, sourceMessages: messages };
};
