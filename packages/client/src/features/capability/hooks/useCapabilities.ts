import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useChatStore } from "../../chat/stores/useChatStore.ts";
import { ClientCapabilityService } from "../services/ClientCapabilityService.ts";

export const useCapabilities = () => {
	const client = useContext(ClientProvider);

	const { session } = useSession();
	const { providers } = useProviders();
	const createIncognito = useChatStore((s) => s.createIncognito);

	const presumedCapabilities = useQuery({
		queryKey: [
			"capabilities",
			session.data?.user.id,
			providers.data,
			createIncognito,
		],
		queryFn: async () => {
			if (!session.data) return {};
			return ClientCapabilityService.getPresumedCapabilities({
				client,
				user: session.data.user,
				chat: true,
				message: true,
				incognito: createIncognito,
				providers: providers.data,
			});
		},
	});

	return { presumedCapabilities };
};
