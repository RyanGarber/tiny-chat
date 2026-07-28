import { JsonTree } from "@gfazioli/mantine-json-tree";
import { useHotkeys } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useProviders } from "#frontend/features/config/hooks/useProviders.ts";
import { useTools } from "#frontend/features/config/hooks/useTools.ts";
import { useSkills } from "#frontend/features/file/hooks/useSkills.ts";
import { useInputStore } from "#frontend/features/input/stores/useInputStore.ts";
import { useMessages } from "#frontend/features/message/hooks/useMessages.ts";
import { MessageHandlerService } from "#frontend/features/message/services/MessageHandlerService.ts";
import { auth } from "#frontend/utils/api.ts";

export const useExperiments = () => {
	const session = auth.useSession();
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
						void MessageHandlerService.handle({
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

	const editor = useInputStore((s) => s.editor);
	const _keyup = useInputStore((s) => s._keyup);

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
