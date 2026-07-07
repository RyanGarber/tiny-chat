import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { query, trpc } from '@/utils/api';
import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import { fetchNextEmbeddingBatch } from '@/features/config/hooks/useEmbedding.ts';
import type { UploadType } from '@tiny-chat/backend/generated/prisma/enums.ts';

export const uploadMutationKey = ['upload'] as const;

export const useUploads = () => {
  const attachmentUploads = useInfiniteQuery({
    ...query.input.listUploads.infiniteQueryOptions(
      { limit: 10, type: 'ATTACHMENT' },
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
    ...query.input.listUploads.queryOptions({ type: 'GITHUB' }),
    select: (data) =>
      data.uploads.map((u) => ({
        ...u,
        repoName: u.name.split('@')[0].replace('GitHub: ', '').trim(),
        branch: u.name.split('@')[1].trim(),
      })),
  });

  const upload = useMutation({
    mutationKey: uploadMutationKey,
    mutationFn: async ({ type, file }: { type: UploadType; file: File }) => {
      const data = new FormData();
      data.set('type', type);
      data.set('file', file);
      return trpc.input.createUpload.mutate(data);
    },

    onSuccess: (result, variables) => {
      console.log('Upload suceeded:', result);
      void attachmentUploads.refetch();
      void fetchNextEmbeddingBatch();
      if (variables.type !== 'SKILL') useMessagingStore.getState().addUploads(result);
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
