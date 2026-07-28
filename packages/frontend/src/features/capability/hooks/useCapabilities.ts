import { useQuery } from "@tanstack/react-query";
import { useTauri } from "#frontend/core/hooks/useTauri.ts";
import { FrontendCapabilityService } from "#frontend/features/capability/services/FrontendCapabilityService.ts";
import { useChatStore } from "#frontend/features/chat/stores/useChatStore.ts";
import { useProviders } from "#frontend/features/config/hooks/useProviders.ts";
import { auth } from "#frontend/utils/api.ts";

export const useCapabilities = () => {
	const session = auth.useSession();
	const { providers } = useProviders();
	const { isTauriDesktop } = useTauri();
	const createIncognito = useChatStore((s) => s.createIncognito);

	const presumedCapabilities = useQuery({
		queryKey: ["capabilities", session.data?.user.id, isTauriDesktop.data],
		queryFn: async () => {
			if (!session.data) return {};
			return FrontendCapabilityService.getPresumedCapabilities({
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
