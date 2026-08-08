import { useCallback, useSyncExternalStore } from "react";
import { ToolStreamService } from "../services/ToolStreamService.ts";

/**
 * Live output for a tool call that is still running. Returns undefined once the
 * call's result has been saved, at which point the saved result is what should
 * be shown instead.
 */
export const useToolStream = ({
	message,
	part,
}: {
	message: { id: string };
	part: { id: string };
}) => {
	const key = ToolStreamService.key({
		messageId: message.id,
		partId: part.id,
	});

	const stream = useSyncExternalStore(
		useCallback(
			(listener: () => void) => ToolStreamService.subscribe(key, listener),
			[key],
		),
		useCallback(() => ToolStreamService.get(key), [key]),
		useCallback(() => ToolStreamService.get(key), [key]),
	);

	return { stream };
};
