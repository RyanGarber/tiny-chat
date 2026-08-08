import { useSyncExternalStore } from "react";
import { StreamService } from "../../chat/services/StreamService.ts";

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
