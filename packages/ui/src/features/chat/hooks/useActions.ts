import { useQuery } from "@tanstack/react-query";
import { client } from "#ui/client.ts";

export const refetchActions = async () => {
	return client.queryClient.invalidateQueries({
		queryKey: client.query.action.getActions.pathKey(),
	});
};

export const useActions = () => {
	const actions = useQuery({
		...client.query.action.getActions.queryOptions(),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { actions };
};
