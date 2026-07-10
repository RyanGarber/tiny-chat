import { useQuery } from "@tanstack/react-query";
import { query, queryClient } from "#frontend/utils/api.ts";

export const refetchMemories = async () => {
	return queryClient.invalidateQueries({
		queryKey: query.context.listMemories.pathKey(),
	});
};

export const useMemories = () => {
	const memories = useQuery({
		...query.context.listMemories.queryOptions(),
		select: (data) => data,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return memories;
};
