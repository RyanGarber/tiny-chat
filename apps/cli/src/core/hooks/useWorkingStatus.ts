import type {
	UseInfiniteQueryResult,
	UseMutationResult,
	UseQueryResult,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore.ts";

export const useWorkingStatus = (
	...queries: (
		| UseQueryResult<any, any>
		| UseInfiniteQueryResult<any, any>
		| UseMutationResult<any, any, any, any>
	)[]
) => {
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	const isWorking = queries.some(
		(query) =>
			("isFetching" in query && query.isFetching) ||
			("isPending" in query && query.isPending),
	);

	useEffect(() => {
		if (isWorking) setStatus({ id: "loading" });
		else unsetStatus({ id: "loading" });
	}, [isWorking, setStatus, unsetStatus]);
};
