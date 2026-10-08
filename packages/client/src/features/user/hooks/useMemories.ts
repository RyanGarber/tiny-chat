import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "#client/client.ts";
import { UserService } from "#client/features/user/services/UserService.ts";
import type { MemoryState } from "#core/features/data/types/memory.ts";

/** A memory as it is written by hand rather than learned from a chat. */
export type MemoryDraft = Pick<MemoryState, "fact" | "category" | "stability">;

export const useMemories = () => {
	const client = useContext(ClientContext);

	const memories = useQuery({
		...client.query.memory.getMemories.queryOptions(),
		select: (data) => data,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const onSuccess = () => UserService.fetchMemories({ client });

	// Written by the user, so stated outright rather than inferred.
	const createMemory = useMutation({
		mutationFn: (memory: MemoryDraft) =>
			client.api.memory.createMemory.mutate({
				...memory,
				evidence: [],
				confidence: 1,
			}),
		onSuccess,
	});

	// The memory keeps the chat it came from and what it was learned from.
	const updateMemory = useMutation({
		mutationFn: ({
			memory,
			...changes
		}: Partial<MemoryDraft> & { memory: MemoryState }) =>
			client.api.memory.updateMemory.mutate({
				id: memory.id,
				fact: changes.fact ?? memory.fact,
				category: changes.category ?? memory.category,
				stability: changes.stability ?? memory.stability,
				evidence: [...memory.evidence],
				confidence: memory.confidence,
			}),
		onSuccess,
	});

	const deleteMemory = useMutation({
		...client.query.memory.deleteMemory.mutationOptions(),
		onSuccess,
	});

	return { memories, createMemory, updateMemory, deleteMemory };
};
