import { useQuery } from "@tanstack/react-query";
import { query, queryClient } from "#frontend/utils/api.ts";

export const refetchMemories = async () => {
	return queryClient.invalidateQueries({
		queryKey: query.memory.getMemories.pathKey(),
	});
};

export const useMemories = () => {
	const memories = useQuery({
		...query.memory.getMemories.queryOptions(),
		select: (data) => data,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { memories };
};
