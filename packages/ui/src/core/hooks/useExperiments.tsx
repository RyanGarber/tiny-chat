import { JsonTree } from "@gfazioli/mantine-json-tree";
import { useHotkeys } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { client } from "#ui/client.ts";
import { useChat } from "#ui/features/chat/hooks/useChat.ts";
import { useProviders } from "#ui/features/config/hooks/useProviders.ts";
import { useTools } from "#ui/features/config/hooks/useTools.ts";
import { useSkills } from "#ui/features/file/hooks/useSkills.ts";
import { useInputStore } from "#ui/features/input/stores/useInputStore.ts";
import { useMessages } from "#ui/features/message/hooks/useMessages.ts";
import { MessageHandlerService } from "#ui/features/message/services/MessageHandlerService.ts";

export const useExperiments = () => {
	const session = client.auth.useSession();
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
