import { useContext, useEffect, useRef } from "react";
import { ClientContext } from "#client/client.ts";
import { useChatList } from "#client/features/chat/hooks/useChatList.ts";
import { ChatService } from "#client/features/chat/services/ChatService.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";

/**
 * Once the project list loads, selects the project with a folder most closely
 * holding the directory the runtime was launched in. Folders sync across
 * devices, so any of a project's folders may be this device's copy. Does
 * nothing if a chat or project is already selected, and only ever runs once.
 */
export const useDefaultProject = () => {
	const client = useContext(ClientContext);
	const { projects } = useChatList();
	const done = useRef(false);

	useEffect(() => {
		const shell = client.shell;
		if (done.current || !projects.data || !shell?.cwd) return;
		const cwd = shell.cwd;
		done.current = true;

		const { active } = useChatStore.getState();
		if (active.chatId || active.project) return;

		const list = projects.data.pages.flatMap((page) => page.projects);
		void cwd().then((cwd) => {
			if (useChatStore.getState().active.chatId) return;
			// Folders are stored as picked; `cwd` is as the shell spells it.
			let match: { project: (typeof list)[number]; length: number } | null =
				null;
			for (const project of list) {
				for (const { path } of project.settings?.folders ?? []) {
					const folder = shell.toShellPath?.({ path }) ?? path;
					if (
						SettingsUtils.contains({ folder, path: cwd }) &&
						folder.length > (match?.length ?? -1)
					)
						match = { project, length: folder.length };
				}
			}
			if (match) ChatService.newChat(match.project);
		});
	}, [client, projects.data]);
};
