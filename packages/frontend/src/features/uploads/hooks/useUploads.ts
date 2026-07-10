import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import type { UploadType } from "@tiny-chat/backend/generated/prisma/enums.ts";
import { useInputStore } from "#frontend/features/chat/stores/useInputStore.ts";
import { fetchNextEmbeddingBatch } from "#frontend/features/config/hooks/useEmbedding.ts";
import { query, trpc } from "#frontend/utils/api.ts";

export const uploadMutationKey = ["upload"] as const;

export const useUploads = () => {
	const attachmentUploads = useInfiniteQuery({
		...query.input.listUploads.infiniteQueryOptions(
			{ limit: 10, type: "ATTACHMENT" },
			{
				getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
				select: (data) => ({
					pages: data.pages,
					pageParams: data.pageParams,
				}),
			},
		),
	});

	const githubUploads = useQuery({
		...query.input.listUploads.queryOptions({ type: "GITHUB" }),
		select: (data) =>
			data.uploads.map((u) => ({
				...u,
				repoName: u.name.split("@")[0].trim(),
				branch: u.name.split("@")[1].trim(),
			})),
	});

	const upload = useMutation({
		mutationKey: uploadMutationKey,
		mutationFn: async ({ type, file }: { type: UploadType; file: File }) => {
			const data = new FormData();
			data.set("type", type);
			data.set("file", file);
			return trpc.input.createUpload.mutate(data);
		},

		onSuccess: (result, variables) => {
			console.log("Upload suceeded:", result);
			const { addAttachment } = useInputStore.getState();
			void attachmentUploads.refetch();
			void fetchNextEmbeddingBatch();
			if (variables.type !== "SKILL") addAttachment(result);
		},
	});

	const deleteUpload = useMutation({
		...query.input.deleteUpload.mutationOptions(),
		onSuccess: () => {
			void attachmentUploads.refetch();
		},
	});

	return { attachmentUploads, githubUploads, upload, deleteUpload };
};
