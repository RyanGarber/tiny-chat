import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { backendUrl, query, trpc } from '@/utils/api';
import { useMessagingStore, type Upload } from '@/features/chat/stores/useMessagingStore';
import { zUploadOutput } from '@tiny-chat/shared/src/types/chat';

export const uploadMutationKey = ['upload'] as const;

export const useUploads = () => {
  const fileUploads = useInfiniteQuery({
    ...query.persistence.listUploads.infiniteQueryOptions(
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
    ...query.persistence.listUploads.queryOptions({ is: 'github' }),
    select: (data) =>
      data.uploads.map((u) => ({
        ...u,
        repoName: u.name.split('@')[0].replace('GitHub: ', '').trim(),
        branch: u.name.split('@')[1].trim(),
      })),
  });

  const upload = useMutation({
    mutationKey: uploadMutationKey,
    mutationFn: async ({
      type,
      files,
      onProgress,
    }: {
      type: 'upload' | 'skill';
      files: File[];
      onProgress?: (progress: number) => void;
    }) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file, file.name);
      }

      const token = localStorage.getItem('token');

      const result = await new Promise<Upload[]>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${backendUrl}/@/upload`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('X-Upload-Type', type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress?.(percentComplete);
          }
        };

        xhr.onload = () => {
          try {
            resolve(zUploadOutput.parse(JSON.parse(xhr.responseText.slice(6))));
          } catch {
            reject(new Error(xhr.responseText));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Failed to upload'));
        };

        xhr.send(formData);
      });

      return result;
    },

    onSuccess: (result) => {
      console.log('upload success:', result);
      void fileUploads.refetch();
      useMessagingStore.getState().addUploads(...result);
    },
  });

  const deleteUpload = useMutation({
    mutationFn: (id: string) => trpc.persistence.deleteFiles.mutate({ type: 'upload', id }),
    onSuccess: () => {
      void fileUploads.refetch();
    },
  });

  return { fileUploads, repoUploads, upload, deleteUpload };
};
