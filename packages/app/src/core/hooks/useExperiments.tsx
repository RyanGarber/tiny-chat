import { JsonTree } from "@gfazioli/mantine-json-tree";
import { useHotkeys } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { useProviders } from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { AgentMessageService } from "@tiny-chat/client/src/features/agent/services/AgentMessageService.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useSession } from "#client/src/core/hooks/useSession.ts";
import { useSkills } from "#client/src/features/agent/hooks/useSkills.ts";
import { useMessages } from "#client/src/features/chat/hooks/useMessages.ts";
import { client } from "#ui/client.ts";
import { useEditorStore } from "#ui/features/editor/stores/useEditorStore.ts";

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
						void AgentMessageService.handle({
							client,
							user: session.data.user,
							message,
							chat: chat.data,
							append: [],
							mcpTools: mcpTools.data,
							skills,
							providers: providers.data,
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
