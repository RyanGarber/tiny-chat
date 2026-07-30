import { useQuery } from "@tanstack/react-query";
import { client } from "#ui/client.ts";
import { useTauri } from "#ui/core/hooks/useTauri.ts";
import { ClientCapabilityService } from "#ui/features/capability/services/ClientCapabilityService.ts";
import { useChatStore } from "#ui/features/chat/stores/useChatStore.ts";
import { useProviders } from "#ui/features/config/hooks/useProviders.ts";

export const useCapabilities = () => {
	const session = client.auth.useSession();
	const { providers } = useProviders();
	const { isTauriDesktop } = useTauri();
	const createIncognito = useChatStore((s) => s.createIncognito);

	const presumedCapabilities = useQuery({
		queryKey: [
			"capabilities",
			session.data?.user.id,
			isTauriDesktop.data,
			providers.data,
			createIncognito,
		],
		queryFn: async () => {
			if (!session.data) return {};
			return ClientCapabilityService.getPresumedCapabilities({
				user: session.data.user,
				chat: true,
				message: true,
				desktop: isTauriDesktop.data,
				incognito: createIncognito,
				providers: providers.data,
			});
		},
	});

	return { presumedCapabilities };
};
