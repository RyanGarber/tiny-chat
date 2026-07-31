import { ChatService } from "@tiny-chat/react/src/features/chat/services/ChatService.ts";
import { useChatStore } from "@tiny-chat/react/src/features/chat/stores/useChatStore.ts";
import { useEffect, useRef } from "react";
import { client } from "#ui/client.ts";

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

	const lastChatIdRef = useRef(chatId);
	const lastHashbangRef = useRef(getHashbang());

	// 1. Sync: Zustand -> URL
	useEffect(() => {
		if (chatId !== lastChatIdRef.current) {
			setHashbang(chatId);
			lastChatIdRef.current = chatId;
		}

		const onHashChange = () => {
			const { hash } = getHashbang();
			if (hash !== lastHashbangRef.current.hash) {
				ChatService.setChatId(hash);
			}
			lastHashbangRef.current = getHashbang();
		};

		// Run once on load
		onHashChange();

		window.addEventListener("hashchange", onHashChange);
		return () => window.removeEventListener("hashchange", onHashChange);
	}, [chatId]);

	return getHashbang();
};
