import { useMutation, useQuery } from "@tanstack/react-query";
import { client } from "#ui/client.ts";

export const useHiddenModels = () => {
	const hiddenModels = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.hiddenModels,
	});

	const setHiddenModels = useMutation({
		...client.query.settings.setHiddenModels.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	return {
		hiddenModels,
		setHiddenModels,
	};
};
