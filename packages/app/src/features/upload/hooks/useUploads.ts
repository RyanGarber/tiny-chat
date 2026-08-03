import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { UserService } from "@tiny-chat/client/src/features/user/services/UserService.ts";
import { client } from "#app/client.ts";
import { useMessagingStore } from "#client/src/features/chat/stores/useMessagingStore.ts";
import { UploadType } from "#core/features/file/types/upload";

export const uploadMutationKey = ["upload"] as const;

export const useUploads = () => {
	const attachmentUploads = useInfiniteQuery({
		...client.query.upload.getUploads.infiniteQueryOptions(
			{ where: { type: UploadType.ATTACHMENT }, limit: 10 },
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
		...client.query.upload.getUploads.queryOptions({
			where: { type: UploadType.GITHUB },
		}),
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
			return client.api.upload.createUpload.mutate(data);
		},

		onSuccess: (result, variables) => {
			console.log("[useUploads] uploaded:", result);
			const { addAttachment } = useMessagingStore.getState();
			void attachmentUploads.refetch();
			void UserService.fetchNextEmbeddingBatch({ client });
			if (variables.type !== "SKILL") addAttachment(result);
		},
	});

	const deleteUpload = useMutation({
		...client.query.upload.deleteUpload.mutationOptions(),
		onSuccess: () => {
			void attachmentUploads.refetch();
		},
	});

	return { attachmentUploads, githubUploads, upload, deleteUpload };
};
