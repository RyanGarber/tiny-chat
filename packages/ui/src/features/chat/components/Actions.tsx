import { Icon } from "@iconify/react";
import { Box, Card, Divider, Group, Stack, Text } from "@mantine/core";
import { zData } from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { useEffect, useMemo, useState } from "react";
import { format } from "timeago.js";
import { useActions } from "#ui/features/chat/hooks/useActions.ts";
import { useChat } from "#ui/features/chat/hooks/useChat.ts";

export default function Actions() {
	const { chat } = useChat();
	const { actions } = useActions();

	const activeActions = useMemo(
		() =>
			actions.data?.filter(
				(a) =>
					a.chatId === chat.data?.id &&
					a.nextRunAt !== null &&
					a.nextRunAt > new Date(),
			) ?? [],
		[actions.data, chat.data],
	);

	const [, tick] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => tick((n) => n + 1), 1000);
		return () => clearInterval(interval);
	}, []);

	return activeActions.length ? (
		<Card w="100%" px={20} py={10}>
			<Group w="100%" c="dimmed">
				<Icon icon="lucide:clock" />
				<Stack gap={0} flex={1}>
					{activeActions.map((action, i, array) => (
						<Box key={action.id}>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "minmax(0, 1fr) auto", // MAGIC LINE: forces col 1 to 0 if needed
									gap: "8px",
									width: "100%",
									alignItems: "center",
								}}
							>
								<Text
									size="sm"
									style={{
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{DataUtils.getTextCleaned({
										data: zData.parse(action.data),
									})}
								</Text>
								<Text size="sm" style={{ whiteSpace: "nowrap" }}>
									{action.nextRunAt && format(action.nextRunAt)}
								</Text>
							</div>
							{i !== array.length - 1 && <Divider my="xs" />}
						</Box>
					))}
				</Stack>
			</Group>
		</Card>
	) : undefined;
}
