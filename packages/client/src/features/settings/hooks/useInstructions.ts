import { useMutation, useQuery } from "@tanstack/react-query";
import { zSettings } from "@tiny-chat/core/src/features/data/types/user.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";

export const useInstructions = () => {
	const client = useContext(ClientProvider);
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
