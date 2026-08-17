import { useInput } from "ink";
import { type Page, useAppStore } from "../stores/useAppStore.ts";

export const usePage = ({
	back,
	onBack,
}: {
	back?: string[];
	onBack?: () => Page | boolean | undefined;
} = {}) => {
	const page = useAppStore((state) => state.page);
	const setPage = useAppStore((state) => state.setPage);

	useInput((input, key) => {
		if (key.backspace || key.escape || back?.some((value) => input === value)) {
			const page = onBack?.();
			if (page === false) return;
			setPage(typeof page === "string" ? page : "chat");
		}
	});

	return { page, setPage };
};
