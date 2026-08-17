import { Icon } from "@iconify/react";
import { ActionIcon, Box, Group } from "@mantine/core";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ReactNode, RefObject } from "react";
import { client } from "#app/client.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { MessagingService } from "#client/src/features/chat/services/MessagingService.ts";
import { useMessagingStore } from "#client/src/features/chat/stores/useMessagingStore.ts";

function Effect({
	content,
	onDelete,
	isAny,
}: {
	content: ReactNode;
	onDelete: () => void;
	isAny: boolean;
}) {
	return (
		<Group
			className="input-effect"
			bg="transparent"
			align="center"
			gap={5}
			px={10}
			py={5}
			w="fit-content"
			bdrs={25}
			fz={14}
			opacity={isAny ? 0.5 : 1}
			style={{
				...StyleUtils.glass,
				boxShadow: StyleUtils.shadow,
				pointerEvents: "auto",
			}}
		>
			<ActionIcon
				size={20}
				variant="subtle"
				color="dimmed"
				onClick={onDelete}
				disabled={isAny}
			>
				<Icon icon="lucide:x" height={18} />
			</ActionIcon>
			<Box>{content}</Box>
		</Group>
	);
}

export default function ChatEffects({
	inputEffectsRef,
	inputMaxWidth,
	disabled,
}: {
	inputEffectsRef: RefObject<HTMLDivElement | null>;
	inputMaxWidth: number;
	disabled: boolean;
}) {
	const editing = useMessagingStore((s) => s.editing);
	const insertingAfter = useMessagingStore((s) => s.insertingAfter);
	const truncating = useMessagingStore((s) => s.truncating);
	const isMobile = useAppStore((s) => s.isMobile);
	return (
		<Group
			pos="absolute"
			bottom={0}
			left={isMobile ? 10 : 20}
			right={isMobile ? 10 : 20}
			justify="center"
			style={{
				pointerEvents: "none",
				zIndex: "calc(var(--mantine-z-index-app) + 1)",
			}}
		>
			<div style={{ width: "100%", maxWidth: inputMaxWidth - 40 }}>
				<Group gap={3} pb={3} ref={inputEffectsRef}>
					{editing && (
						<Effect
							content={
								<>
									Editing{" "}
									<span style={{ color: "#aaa" }}>
										{DataUtils.getTextCleaned({
											data: editing.data,
											maxLength: 20,
										})}
									</span>
								</>
							}
							onDelete={() =>
								MessagingService.setEditing({ client, message: null })
							}
							isAny={disabled}
						/>
					)}
					{truncating && (
						<Effect
							content={"Deleting newer"}
							onDelete={() =>
								MessagingService.setTruncating({ truncating: false })
							}
							isAny={disabled}
						/>
					)}
					{insertingAfter && (
						<Effect
							content={
								<>
									Inserting after{" "}
									<span style={{ color: "#aaa" }}>
										{DataUtils.getTextCleaned({
											data: insertingAfter.data,
											maxLength: 20,
										})}
									</span>
								</>
							}
							onDelete={() =>
								MessagingService.setInsertingAfter({ message: null })
							}
							isAny={disabled}
						/>
					)}
				</Group>
			</div>
		</Group>
	);
}
