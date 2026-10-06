import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "#client/client.ts";

export const useActions = () => {
	const client = useContext(ClientContext);

	const actions = useQuery({
		...client.query.action.getActions.queryOptions(),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { actions };
};
