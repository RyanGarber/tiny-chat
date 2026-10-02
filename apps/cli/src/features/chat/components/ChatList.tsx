import { useChatList } from "@tiny-chat/client/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/features/chat/services/ChatService.ts";
import { useMessagingStore } from "@tiny-chat/client/features/chat/stores/useMessagingStore.ts";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useSentinel } from "../../../core/hooks/useSentinel.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";

export default function ChatList({
	fill = false,
}: {
	/** Drawn as a sidebar, taking the full height it is given. */
	fill?: boolean;
}) {
	const { projects, deleteChat } = useChatList();
	useWorkingStatus(projects, deleteChat);

	const project = useMessagingStore((state) => state.project);
	const chats =
		projects.data?.pages.flatMap((page) =>
			project
				? page.projects
						.filter((other) => project.id === other.id)
						.flatMap((other) => other.chats)
				: page.chats,
		) ?? [];

	// Older chats are appended below the list, so reaching the bottom is what
	// asks for the next page.
	const fetchOlder = useSentinel(projects);

	const { setPage } = usePage();

	return (
		<Completions
			fill={fill}
			itemProps={fill ? { flexGrow: 1, minWidth: 0 } : undefined}
			renderItem={
				fill
					? ({ item }) => <Text wrap="truncate-end">{item.name}</Text>
					: undefined
			}
			groups={[
				{
					items: chats.map((chat) => ({
						name: chat.title || "Untitled",
						value: chat.id,
					})),
				},
			]}
			onInput={({ item, input, key }) => {
				if (key.return && item) {
					ChatService.setChat({ id: item.value });
					setPage("chat");
				}
				if (input === "d" && item) {
					const chat = chats.find((chat) => chat.id === item.value);
					if (!chat) return;
					deleteChat.mutate({ chat });
				}
			}}
			renderEmpty={() => "nothing here yet"}
			actions={[{ key: "d", name: "delete" }, "select", "back"]}
			selectFirstOnChange={false}
			onReachBottom={project ? undefined : fetchOlder}
		/>
	);
}
