import { JsonTree } from "@gfazioli/mantine-json-tree";
import { useHotkeys } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { useProviders } from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { ClientMessageService } from "@tiny-chat/client/src/features/agent/services/ClientMessageService.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { client } from "#app/client.ts";
import { useEditorStore } from "#app/features/editor/stores/useEditorStore.ts";
import { useSession } from "#client/src/core/hooks/useSession.ts";
import { useSkills } from "#client/src/features/agent/hooks/useSkills.ts";
import { useMessages } from "#client/src/features/message/hooks/useMessages.ts";

export const useExperiments = () => {
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
							append: [],
							providers: providers.data,
							skills,
							mcpTools: mcpTools.data ?? [],
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
