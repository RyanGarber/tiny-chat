import { useQuery } from "@tanstack/react-query";
import { client } from "#ui/client.ts";

export const refetchMemories = async () => {
	return client.queryClient.invalidateQueries({
		queryKey: client.query.memory.getMemories.pathKey(),
	});
};

export const useMemories = () => {
	const memories = useQuery({
		...client.query.memory.getMemories.queryOptions(),
		select: (data) => data,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { memories };
};
