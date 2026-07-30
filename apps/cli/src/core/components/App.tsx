import { GreetingUtils } from "@tiny-chat/shared/src/features/ui/utils/GreetingUtils.ts";
import { Box, Text, useWindowSize } from "ink";
import { useMemo } from "react";
import Chat from "../../features/chat/components/Chat.tsx";
import { useChatStore } from "../../features/chat/stores/useChatStore.ts";
import Input from "../../features/input/components/Input.tsx";
import { useSession } from "../hooks/useSession.ts";
import Status from "./Status.tsx";

export default function App() {
	const { rows } = useWindowSize();
	const { session } = useSession();

	const chatId = useChatStore((state) => state.chatId);

	const greeting = useMemo(() => {
		return GreetingUtils.get({ name: session.data?.user?.name.split(" ")[0] });
	}, [session.data]);

	return (
		<Box flexDirection="column" height={rows}>
			{chatId ? (
				<Chat />
			) : (
				<Box flexGrow={1} justifyContent="center" alignItems="center">
					<Text>{greeting}</Text>
				</Box>
			)}
			<Status />
			<Input />
		</Box>
	);
}
