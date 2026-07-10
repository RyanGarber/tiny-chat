import { useQuery } from "@tanstack/react-query";
import { query, queryClient } from "#frontend/utils/api.ts";
import { getNextRunAt } from "#shared/utils.ts";

export const refetchActions = async () => {
	return queryClient.invalidateQueries({
		queryKey: query.context.listActions.pathKey(),
	});
};

export const useActions = () => {
	return useQuery({
		...query.context.listActions.queryOptions(),
		select: (data) => data.map((a) => ({ ...a, nextRunAt: getNextRunAt(a) })),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});
};
