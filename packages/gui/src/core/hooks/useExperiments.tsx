import { JsonTree } from "@gfazioli/mantine-json-tree";
import { useHotkeys } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { useContext } from "react";
import { ClientContext } from "#client/client.ts";
import { useSession } from "#client/core/hooks/useSession.ts";
import { useProviders } from "#client/features/agent/hooks/useProviders.ts";
import { useSkills } from "#client/features/agent/hooks/useSkills.ts";
import { useTools } from "#client/features/agent/hooks/useTools.ts";
import { ClientMessageService } from "#client/features/agent/services/ClientMessageService.ts";
import { useChat } from "#client/features/chat/hooks/useChat.ts";
import { useMessages } from "#client/features/message/hooks/useMessages.ts";
import { useEditorStore } from "#gui/features/editor/stores/useEditorStore.ts";

export const useExperiments = () => {
	const client = useContext(ClientContext);

	const { session } = useSession();
	const { chat } = useChat();
	const { messages } = useMessages();
	const { mcpTools } = useTools();
	const { skills } = useSkills();
	const { providers } = useProviders();

	useHotkeys([
		[
			"mod+.",
			() => {
				const message = messages.data?.pages
					.flatMap((page) => page.messages)
					.at(-1);
				if (!message) return;
				modals.openConfirmModal({
					title: "Continue response",
					children: <JsonTree data={message.data.flat()} withExpandAll />,
					labels: { confirm: "Continue", cancel: "Cancel" },
					onConfirm: () =>
						session.data &&
						chat.data &&
						providers.data &&
						void ClientMessageService.onMessage({
							client,
							user: session.data.user,
							message,
							chat: chat.data,
							toolResults: [],
							providers: providers.data,
							skills,
							mcpTools: mcpTools.data ?? [],
							resume: true,
						}),
				});
			},
		],
	]);

	const editor = useEditorStore((s) => s.editor);
	const _keyup = useEditorStore((s) => s._keyup);

	useHotkeys([
		[
			"mod+\\",
			() => {
				console.log("[useExperiments] destroying editor");
				editor?.destroy();
				_keyup();
			},
		],
	]);
};
