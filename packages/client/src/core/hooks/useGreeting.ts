import { useMemo } from "react";
import { useChatStore } from "../../features/chat/stores/useChatStore.ts";
import { GreetingUtils } from "../utils/GreetingUtils.ts";
import { useSession } from "./useSession.ts";

export function useGreeting() {
	const { session } = useSession();

	const createIncognito = useChatStore((s) => s.createIncognito);

	const name =
		session.data?.user && !session.data.user.isAnonymous && !createIncognito
			? session.data.user.name.split(" ")[0]
			: undefined;

	return useMemo(() => GreetingUtils.get({ name }), [name]);
}
