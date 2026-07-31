import type {
	UseInfiniteQueryResult,
	UseQueryResult,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore.ts";

export const useLoadingStatus = (
	query: UseQueryResult<any, any> | UseInfiniteQueryResult<any, any>,
) => {
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	useEffect(() => {
		if (query.isFetching) setStatus({ id: "loading" });
		else unsetStatus({ id: "loading" });
	}, [query.isFetching]);
};
