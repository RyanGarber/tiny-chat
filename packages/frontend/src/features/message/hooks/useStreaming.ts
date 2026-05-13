import { useSyncExternalStore } from 'react';
import { StreamService } from '../services/StreamService';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopSubscribe = (): (() => void) => () => {};
const returnUndefined = (): undefined => undefined;
const returnNegOne = (): number => -1;

export const useMessageStream = (id: string | undefined) => {
  const stream = useSyncExternalStore(
    StreamService.subscribe,
    id === undefined ? returnUndefined : () => StreamService.get(id),
    returnUndefined,
  );

  useSyncExternalStore(
    stream?.subscribe ?? noopSubscribe,
    stream?.getVersion ?? returnNegOne,
    returnNegOne,
  );

  return stream?.message;
};

export const useStreamingIds = () => {
  return useSyncExternalStore(StreamService.subscribe, StreamService.getIds, StreamService.getIds);
};

export const useIsStreaming = () => {
  return useStreamingIds().length > 0;
};
