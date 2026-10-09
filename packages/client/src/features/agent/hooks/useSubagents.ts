import { useQuery } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useMessages } from "#client/features/message/hooks/useMessages.ts";

/** The subagent runs kept with the messages on the chat's open branch. */
export const useSubagents = () => {
	const client = useContext(ClientContext);

	const { messages } = useMessages();

	const ids = useMemo(
		() => (messages.data?.messages ?? []).map((message) => message.id),
		[messages.data],
	);

	const subagents = useQuery({
		...client.query.subagent.getSubagents.queryOptions({ messages: ids }),
		enabled: ids.length > 0,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		placeholderData: (previous) => previous,
	});

	return { subagents };
};
