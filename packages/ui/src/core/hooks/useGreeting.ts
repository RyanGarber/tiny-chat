import { GreetingUtils } from "@tiny-chat/core/src/features/ui/utils/GreetingUtils.ts";
import { useMemo } from "react";
import { client } from "#ui/client.ts";
import { useChatStore } from "#ui/features/chat/stores/useChatStore.ts";

export function useGreeting() {
	const session = client.auth.useSession();
	const createIncognito = useChatStore((s) => s.createIncognito);

	const name =
		session.data && !session.data.user?.isAnonymous && !createIncognito
			? session.data.user?.name.split(" ")[0]
			: undefined;

	return useMemo(() => GreetingUtils.get({ name }), [name]);
}
