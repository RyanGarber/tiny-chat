import { useEffect } from "react";
import { refetchChat } from "#ui/features/chat/hooks/useChat.ts";
import { useChatStore } from "#ui/features/chat/stores/useChatStore.ts";

const getHashbang = (): {
	hash: string;
	query: Record<string, string>;
} => {
	if (window.location.hash.length < 2) window.location.hash = "#/";
	const hash = window.location.hash.split(/[?&]/);
	new URLSearchParams(hash.slice(1).join("&"));
	return {
		hash: hash[0].slice(2),
		query: Object.fromEntries(
			new URLSearchParams(hash.slice(1).join("&")).entries(),
		),
	};
};

export const setHashbang = (
	hash: string | null,
	query?: Record<string, string | undefined>,
) => {
	query ??= getHashbang().query;
	const queryString = new URLSearchParams(
		Object.fromEntries(
			Object.entries(query).filter(([_, value]) => value !== undefined),
		) as Record<string, string>,
	).toString();
	window.location.hash = `#/${hash ?? ""}${queryString ? `?${queryString}` : ""}`;
};

export const useHashbang = () => {
	const chatId = useChatStore((s) => s.chatId);
	const setChatId = useChatStore((s) => s.setChatId);

	// 1. Sync: URL -> Zustand (On mount and on hash change)
	useEffect(() => {
		const handleHashChange = () => {
			const { hash } = getHashbang();
			if (hash !== chatId) {
				setChatId(hash || null);
				if (hash) {
					void refetchChat(hash);
				}
			}
		};

		// Run once on load
		handleHashChange();

		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, [chatId, setChatId]);

	return getHashbang();
};
