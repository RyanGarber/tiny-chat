import { useCallback, useSyncExternalStore } from "react";
import { GenericStreamService } from "#client/core/services/StreamService.ts";
import type { StreamState } from "#core/core/types/stream.ts";

export const useStream = <T>(id: string): StreamState<T> | undefined => {
	return useSyncExternalStore(
		useCallback(
			(listener: () => void) =>
				GenericStreamService.of<T>().subscribe(id, listener),
			[id],
		),
		useCallback(() => GenericStreamService.of<T>().get(id), [id]),
		useCallback(() => GenericStreamService.of<T>().get(id), [id]),
	);
};
