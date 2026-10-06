import { useContext, useEffect, useRef } from "react";
import { ClientContext } from "#client/client.ts";
import { useChatList } from "#client/features/chat/hooks/useChatList.ts";
import { ChatService } from "#client/features/chat/services/ChatService.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.ts";

/**
 * Once the project list loads, selects the first project whose primary folder
 * is the directory the runtime was launched in. Does nothing if a chat or
 * project is already selected, and only ever runs once.
 */
export const useDefaultProject = () => {
	const client = useContext(ClientContext);
	const { projects } = useChatList();
	const done = useRef(false);

	useEffect(() => {
		if (done.current || !projects.data || !client.shell?.cwd) return;
		const cwd = client.shell.cwd;
		done.current = true;

		if (useChatStore.getState().chatId || useMessagingStore.getState().project)
			return;

		const list = projects.data.pages.flatMap((page) => page.projects);
		void cwd().then((cwd) => {
			if (useChatStore.getState().chatId) return;
			const match = list.find(
				(project) => project.settings?.folders?.[0]?.path === cwd,
			);
			if (match) ChatService.newChat(match);
		});
	}, [client, projects.data]);
};
