import { useMutation, useQuery } from "@tanstack/react-query";
import { query, queryClient } from "#frontend/utils/api.ts";

export const useHiddenModels = () => {
	const hiddenModels = useQuery({
		...query.settings.get.queryOptions(),
		select: (data) => data.hiddenModels,
	});

	const setHiddenModels = useMutation({
		...query.settings.setHiddenModels.mutationOptions(),
		onSuccess: (data) => {
			queryClient.setQueryData(query.settings.get.queryKey(), data);
		},
	});

	return {
		hiddenModels,
		setHiddenModels,
	};
};
