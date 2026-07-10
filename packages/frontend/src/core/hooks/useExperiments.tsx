import { JsonTree } from "@gfazioli/mantine-json-tree";
import { useHotkeys } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useConfig } from "#frontend/features/config/hooks/useConfig.ts";
import { useProviders } from "#frontend/features/config/hooks/useProviders.ts";
import { useTools } from "#frontend/features/config/hooks/useTools.ts";
import { useMessages } from "#frontend/features/message/hooks/useMessages.ts";
import { GenerateService } from "#frontend/features/message/services/GenerateService.ts";
import { useSkills } from "#frontend/features/uploads/hooks/useSkills.ts";
import { importChat } from "#frontend/utils/ui.tsx";

export const useExperiments = () => {
	const { config } = useConfig();
	const { chat } = useChat();
	const { messages } = useMessages();
	const { toolGroups } = useTools();
	const { skills } = useSkills();
	const { providers } = useProviders();

	useHotkeys([
		[
			"mod+i",
			async () => {
				const messages = JSON.parse(
					await navigator.clipboard.readText(),
				) as Parameters<typeof importChat>[0];
				console.log("Opening confirm modal with messages", messages);
				modals.openConfirmModal({
					title: "Import chat",
					children: <JsonTree data={messages} withExpandAll />,
					labels: { confirm: "Import", cancel: "Cancel" },
					onConfirm: () => void importChat(messages, config),
				});
			},
		],
	]);

	useHotkeys([
		[
			"mod+.",
			() => {
				const message = messages.data?.pages
					.flatMap((page) => page.messages)
					.at(-1);
				if (!chat.data || !providers.data || !message) return;
				modals.openConfirmModal({
					title: "Continue response",
					children: <JsonTree data={message.data.flat()} withExpandAll />,
					labels: { confirm: "Continue", cancel: "Cancel" },
					onConfirm: () =>
						chat.data &&
						void GenerateService.handle({
							message,
							activeChat: chat.data,
							append: [],
							tools: toolGroups,
							skills,
							providers: providers.data,
						}),
				});
			},
		],
	]);
};
