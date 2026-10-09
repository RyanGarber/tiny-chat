import { useMemo } from "react";
import { useSession } from "#client/core/hooks/useSession.ts";
import { GreetingUtils } from "#client/core/utils/GreetingUtils.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";

export function useGreeting() {
	const { session } = useSession();

	const createIncognito = useChatStore(
		(s) => s.active.status === "new" && s.active.incognito,
	);

	const name =
		session.data?.user && !session.data.user.isAnonymous && !createIncognito
			? session.data.user.name.split(" ")[0]
			: undefined;

	return useMemo(() => GreetingUtils.get({ name }), [name]);
}
