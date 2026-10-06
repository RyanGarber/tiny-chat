import { useEffect } from "react";
import { useChat } from "#client/features/chat/hooks/useChat.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.ts";

/**
 * Keeps the active project in step with the open chat, so entering a chat
 * (from the list, search, a link or a tool) activates the project it is in,
 * and moving it to another project follows along.
 */
export const useChatProject = () => {
	const { chat } = useChat();

	useEffect(() => {
		const data = chat.data;
		if (!data || data.id !== useChatStore.getState().chatId) return;

		const { project, setProject } = useMessagingStore.getState();
		const next = data.projectId
			? { id: data.projectId, title: data.project?.title ?? null }
			: null;
		if (project?.id === next?.id && project?.title === next?.title) return;
		setProject(next);
	}, [chat.data]);
};
