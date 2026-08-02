import type {
	UseInfiniteQueryResult,
	UseQueryResult,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore.ts";

export const useLoadingStatus = (
	...queries: (UseQueryResult<any, any> | UseInfiniteQueryResult<any, any>)[]
) => {
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	const isFetching = queries.some((query) => query.isFetching);

	useEffect(() => {
		if (isFetching) setStatus({ id: "loading" });
		else unsetStatus({ id: "loading" });
	}, [isFetching, setStatus, unsetStatus]);
};
