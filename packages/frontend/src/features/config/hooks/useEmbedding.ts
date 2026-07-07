import { auth, backendUrl, queryClient, trpc } from '@/utils/api.ts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { embed } from '@tiny-chat/shared/src/services/chat/embed.ts';
import { useEffect, useRef } from 'react';
import { useRetrieval } from '@/features/settings/hooks/useRetrieval.ts';
import { ProviderService } from '@/features/config/services/ProviderService.ts';

export const nextEmbeddingBatchQueryKey = ['embedding', 'next'] as const;
export const runEmbeddingBatchMutationKey = ['embedding', 'run'] as const;

export const fetchNextEmbeddingBatch = async () => {
  await queryClient.invalidateQueries({ queryKey: nextEmbeddingBatchQueryKey });
};

export const useEmbedding = () => {
  const session = auth.useSession();
  const { embeddingConfig } = useRetrieval();

  const nextEmbeddingBatch = useQuery({
    queryKey: [...nextEmbeddingBatchQueryKey, session.data?.user?.id],
    queryFn: async () => {
      if (!session.data || !embeddingConfig.data) return null;

      const missing = await trpc.context.listMissingEmbeddings.query({ limit: 4 });
      console.log('Next batch:', missing);
      return missing;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const runEmbeddingBatch = useMutation({
    mutationKey: runEmbeddingBatchMutationKey,
    mutationFn: async (
      batch: NonNullable<Awaited<ReturnType<typeof trpc.context.listMissingEmbeddings.query>>>,
    ) => {
      if (!session.data || !embeddingConfig.data) return;

      const { messages, actions, memories, files } = batch;
      console.log('Running batch:', batch);

      const input = [
        ...messages.map((message) => ({ messageId: message.id, text: message.text })),
        ...actions.map((action) => ({ actionId: action.id, text: action.text })),
        ...memories.map((memory) => ({ memoryId: memory.id, text: memory.text })),
        ...files.map((file) => ({ fileId: file.id, text: file.text })),
      ];

      const providers = await ProviderService.getChatProviders(session.data.user);
      const result = await embed(
        session.data.user,
        providers.find((p) => p.name === embeddingConfig.data!.provider)!,
        input.map((item) => item.text),
        embeddingConfig.data,
        {
          ...import.meta.env,
          VITE_BACKEND_URL: backendUrl,
        },
      );
      console.log('Embedding result:', result);

      const output = input.map((item, index) => ({ ...item, embedding: result[index] }));
      await trpc.context.saveEmbeddings.mutate(output);
    },
    onSuccess: () => setTimeout(() => void nextEmbeddingBatch.refetch(), 2000),
    onError: (error) => {
      console.warn('Embedding failed:', error);
      // Retry after a delay by refetching the batch — this re-triggers the effect
      // and the pending guard ensures only one attempt runs at a time.
      setTimeout(() => void nextEmbeddingBatch.refetch(), 5000);
    },
  });

  // Keep a stable ref so the effect closure never captures a stale `mutate`.
  const runRef = useRef(runEmbeddingBatch.mutate);
  useEffect(() => {
    runRef.current = runEmbeddingBatch.mutate;
  }, [runEmbeddingBatch.mutate]);

  // A ref-based guard prevents a second Strict Mode invocation of the effect
  // from firing a duplicate mutation before the first one is registered as pending.
  const isPendingRef = useRef(false);

  useEffect(() => {
    const hasPendingMutation =
      isPendingRef.current ||
      queryClient
        .getMutationCache()
        .findAll({ mutationKey: runEmbeddingBatchMutationKey, status: 'pending' }).length > 0;

    if (nextEmbeddingBatch.data && !nextEmbeddingBatch.isFetching && !hasPendingMutation) {
      isPendingRef.current = true;
      runRef.current(nextEmbeddingBatch.data, {
        onSettled: () => {
          isPendingRef.current = false;
        },
      });
    }
  }, [nextEmbeddingBatch.data, nextEmbeddingBatch.isFetching]);

  return { nextEmbeddingBatch, runEmbeddingBatch };
};
