import { useInput } from "ink";
import { useCallback } from "react";
import {
	type Page,
	selectPage,
	useAppStore,
} from "#tui/core/stores/useAppStore.ts";

export const usePage = ({
	back,
	onBack,
	active = true,
}: {
	active?: boolean;
	back?: string[];
	onBack?: () => Page | boolean | undefined;
} = {}) => {
	const page = useAppStore(selectPage);
	const setFocus = useAppStore((state) => state.setFocus);
	/** The chat is opened at its editor. */
	const setPage = useCallback(
		(page: Page) => setFocus(page === "chat" ? "editor" : page),
		[setFocus],
	);

	useInput(
		(input, key) => {
			if (
				key.backspace ||
				key.escape ||
				back?.some((value) => input === value)
			) {
				const page = onBack?.();
				if (page === false) return;
				setPage(typeof page === "string" ? page : "chat");
			}
		},
		{ isActive: active },
	);

	return { page, setPage };
};
