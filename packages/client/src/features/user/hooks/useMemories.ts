import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";

export const useMemories = () => {
	const client = useContext(ClientContext);

	const memories = useQuery({
		...client.query.memory.getMemories.queryOptions(),
		select: (data) => data,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { memories };
};
