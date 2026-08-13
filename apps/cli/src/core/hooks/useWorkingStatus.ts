import type {
	UseInfiniteQueryResult,
	UseMutationResult,
	UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useId } from "react";
import { useAppStore } from "../stores/useAppStore.ts";

export const useWorkingStatus = (
	...queries: (
		| UseQueryResult<any, any>
		| UseInfiniteQueryResult<any, any>
		| UseMutationResult<any, any, any, any>
	)[]
) => {
	const id = useId();

	const setWorkingStatus = useAppStore((state) => state.setWorkingStatus);
	const unsetWorkingStatus = useAppStore((state) => state.unsetWorkingStatus);

	const isWorking = queries.some((query) =>
		"isFetching" in query ? query.isFetching : query.isPending,
	);

	useEffect(() => {
		if (isWorking) setWorkingStatus(id);
		else unsetWorkingStatus(id);
		return () => unsetWorkingStatus(id);
	}, [id, isWorking, setWorkingStatus, unsetWorkingStatus]);
};
