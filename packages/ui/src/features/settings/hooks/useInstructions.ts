import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "#core/features/data/types/user.ts";
import { useSession } from "#react/src/core/hooks/useSession.ts";
import { client } from "#ui/client.ts";

export const useInstructions = () => {
	const { session } = useSession();

	const instructions = useQuery({
		...client.query.settings.get.queryOptions(),
		select: (data) => data.instructions,
		initialData: zSettings.safeParse(session.data?.user?.settings).data,
	});

	const addInstruction = useMutation({
		...client.query.settings.addInstruction.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	const editInstruction = useMutation({
		...client.query.settings.editInstruction.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	const removeInstruction = useMutation({
		...client.query.settings.removeInstruction.mutationOptions(),
		onSuccess: (data) => {
			client.queryClient.setQueryData(
				client.query.settings.get.queryKey(),
				data,
			);
		},
	});

	return {
		instructions,
		addInstruction,
		editInstruction,
		removeInstruction,
	};
};
