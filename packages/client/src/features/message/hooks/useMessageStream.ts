import { useSyncExternalStore } from "react";
import { StreamService } from "../../chat/services/StreamService.ts";

const noopSubscribe = (): (() => void) => () => {};
const returnUndefined = (): undefined => undefined;
const returnNegOne = (): number => -1;

/**
 * A live message snapshot plus the version it was read at.
 *
 * `Stream.apply` mutates the message in place, so the snapshot alone is not a
 * usable memo key — anything derived from it has to be keyed on the version as
 * well. Returning both here means a component can subscribe once and pass the
 * pair down instead of every consumer opening its own subscription.
 */
export const useMessageStream = (id: string | undefined) => {
	const stream = useSyncExternalStore(
		StreamService.subscribe,
		id === undefined ? returnUndefined : () => StreamService.get(id),
		returnUndefined,
	);

	const version = useSyncExternalStore(
		stream?.subscribe ?? noopSubscribe,
		stream?.getVersion ?? returnNegOne,
		returnNegOne,
	);

	return { message: stream?.message, version };
};
