import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { UploadType } from "@tiny-chat/core/src/features/file/types/upload.ts";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { MessagingService } from "../../chat/services/MessagingService.ts";
import { UserService } from "../../user/services/UserService.ts";

export const githubUploadsQueryKey = ["useUploads", "githubUploads"] as const;
export const uploadMutationKey = ["useUploads", "upload"] as const;

export const useUploads = () => {
	const client = useContext(ClientContext);

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
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
	});

	const githubUploads = useQuery({
		queryKey: githubUploadsQueryKey,
		queryFn: async () => {
			const { uploads } = await client.api.upload.getUploads.query({
				where: { type: UploadType.GITHUB },
			});
			return uploads.flatMap((upload) => {
				if (!upload.name.includes("@")) {
					console.warn("[useUploads] GitHub upload has invalid name:", upload);
					return [];
				}
				return [
					{
						...upload,
						repoName: upload.name.split("@")[0].trim(),
						branch: upload.name.split("@")[1].trim(),
					},
				];
			});
		},
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
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
			void attachmentUploads.refetch();
			void UserService.fetchNextEmbeddingBatch({ client });
			// A skill is carried by the message's config rather than its text, so
			// it is the one upload that is not written into the editor.
			if (variables.type !== "SKILL") {
				MessagingService.attachUpload({ client, upload: result });
			}
		},
	});

	const deleteUpload = useMutation({
		...client.query.upload.deleteUpload.mutationOptions(),
		onSuccess: () => {
			void attachmentUploads.refetch();
		},
	});

	const cloneGitHubRepository = useMutation({
		...client.query.upload.cloneGitHubRepository.mutationOptions(),
		onSuccess: () => {
			void githubUploads.refetch();
			void UserService.fetchNextEmbeddingBatch({ client });
		},
	});

	return {
		attachmentUploads,
		githubUploads,
		upload,
		deleteUpload,
		cloneGitHubRepository,
	};
};
