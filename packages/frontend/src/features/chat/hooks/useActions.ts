import { useQuery } from "@tanstack/react-query";
import { query, queryClient } from "#frontend/utils/api.ts";

export const refetchActions = async () => {
	return queryClient.invalidateQueries({
		queryKey: query.action.getActions.pathKey(),
	});
};

export const useActions = () => {
	const actions = useQuery({
		...query.action.getActions.queryOptions(),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { actions };
};
