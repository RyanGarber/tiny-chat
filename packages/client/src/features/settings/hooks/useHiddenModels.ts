import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";

export const useHiddenModels = () => {
	const client = useContext(ClientProvider);

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
