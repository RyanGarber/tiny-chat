import { useWindowSize } from "ink";
import { createContext, useContext } from "react";

/**
 * Columns given to whatever is drawn inside, when that is less than the whole
 * terminal — the transcript, once a sidebar sits beside it.
 */
export const WidthContext = createContext<number | null>(null);

/** Columns the content being drawn has to fit in. */
export const useWidth = () => {
	const { columns } = useWindowSize();
	return useContext(WidthContext) ?? columns;
};
