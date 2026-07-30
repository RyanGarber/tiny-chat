import { GreetingUtils } from "@tiny-chat/shared/src/features/ui/utils/GreetingUtils.ts";
import { useMemo } from "react";
import { useChatStore } from "#frontend/features/chat/stores/useChatStore.ts";
import { auth } from "#frontend/utils/api.ts";

export function useGreeting() {
	const session = auth.useSession();
	const createIncognito = useChatStore((s) => s.createIncognito);

	const name =
		session.data && !session.data.user?.isAnonymous && !createIncognito
			? session.data.user?.name.split(" ")[0]
			: undefined;

	return useMemo(() => GreetingUtils.get({ name }), [name]);
}
