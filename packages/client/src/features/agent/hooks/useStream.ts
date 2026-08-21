import type { StreamState } from "@tiny-chat/core/src/core/types/stream.ts";
import { useCallback, useSyncExternalStore } from "react";
import { GenericStreamService } from "../../../core/services/StreamService.ts";

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
