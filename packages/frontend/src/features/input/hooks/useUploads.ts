import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { query, trpc } from '@/utils/api';
import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import { fetchNextEmbeddingBatch } from '@/features/provider/hooks/useEmbedding';

export const uploadMutationKey = ['upload'] as const;

export const useUploads = () => {
  const fileUploads = useInfiniteQuery({
    ...query.input.listUploads.infiniteQueryOptions(
      { limit: 10, isNot: 'github' },
      {
        getNextPageParam: (lastPage, _pages) => lastPage.nextCursor,
        select: (data) => ({
          pages: data.pages,
          pageParams: data.pageParams,
        }),
      },
    ),
  });

  const repoUploads = useQuery({
    ...query.input.listUploads.queryOptions({ is: 'github' }),
    select: (data) =>
      data.uploads.map((u) => ({
        ...u,
        repoName: u.name.split('@')[0].replace('GitHub: ', '').trim(),
        branch: u.name.split('@')[1].trim(),
      })),
  });

  const upload = useMutation({
    mutationKey: uploadMutationKey,
    mutationFn: async ({ type, file }: { type: 'upload' | 'skill'; file: File }) => {
      const data = new FormData();
      data.set('type', type);
      data.set('file', file);
      return trpc.input.createUpload.mutate(data);
    },

    onSuccess: (result) => {
      console.log('Upload suceeded:', result);
      void fileUploads.refetch();
      void fetchNextEmbeddingBatch();
      useMessagingStore.getState().addUploads(result);
    },
  });

  const deleteUpload = useMutation({
    mutationFn: (id: string) => trpc.input.deleteFiles.mutate({ type: 'upload', id }),
    onSuccess: () => {
      void fileUploads.refetch();
    },
  });

  return { fileUploads, repoUploads, upload, deleteUpload };
};
