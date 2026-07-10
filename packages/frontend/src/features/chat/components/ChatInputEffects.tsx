import { Icon } from "@iconify/react";
import { ActionIcon, Box, Group } from "@mantine/core";
import type { ReactNode, RefObject } from "react";
import { useLayoutStore } from "#frontend/core/stores/useLayoutStore.tsx";
import { useInputStore } from "#frontend/features/chat/stores/useInputStore.ts";
import { useMessagingStore } from "#frontend/features/chat/stores/useMessagingStore.tsx";
import FileThumbnails from "#frontend/features/uploads/components/FileThumbnails.tsx";
import { GLASS_STYLE, SHADOW } from "#frontend/utils/theme.ts";
import { scrubText, texts } from "#shared/utils.ts";

function ChatInputEffect({
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
			style={{ ...GLASS_STYLE, boxShadow: SHADOW, pointerEvents: "auto" }}
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

export default function ChatInputEffects({
	inputEffectsRef,
	inputMaxWidth,
	chatContainerHeight,
	isAny,
}: {
	inputEffectsRef: RefObject<HTMLDivElement | null>;
	inputMaxWidth: number;
	chatContainerHeight: number;
	isAny: boolean;
}) {
	const editing = useMessagingStore((s) => s.editing);
	const setEditing = useMessagingStore((s) => s.setEditing);
	const insertingAfter = useMessagingStore((s) => s.insertingAfter);
	const setInsertingAfter = useMessagingStore((s) => s.setInsertingAfter);
	const truncating = useMessagingStore((s) => s.truncating);
	const setTruncating = useMessagingStore((s) => s.setTruncating);
	const attachments = useInputStore((s) => s.attachments);
	const removeAttachment = useInputStore((s) => s.removeAttachment);
	const isMobile = useLayoutStore((s) => s.isMobile);
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
						<ChatInputEffect
							content={
								<>
									Editing{" "}
									<span style={{ color: "#aaa" }}>
										{scrubText(texts(editing.data), 20)}
									</span>
								</>
							}
							onDelete={() => setEditing(null)}
							isAny={isAny}
						/>
					)}
					{truncating && (
						<ChatInputEffect
							content={"Deleting newer"}
							onDelete={() => setTruncating(false)}
							isAny={isAny}
						/>
					)}
					{insertingAfter && (
						<ChatInputEffect
							content={
								<>
									Inserting after{" "}
									<span style={{ color: "#aaa" }}>
										{scrubText(texts(insertingAfter.data), 20)}
									</span>
								</>
							}
							onDelete={() => setInsertingAfter(null)}
							isAny={isAny}
						/>
					)}
					{attachments.map((upload, i) => (
						<ChatInputEffect
							content={
								<FileThumbnails
									uploads={[
										{
											id: upload.id,
											name: upload.name,
											thumbnail: upload.thumbnail,
										},
									]}
									width={inputMaxWidth}
									maxHeight={chatContainerHeight}
									size={22}
								/>
							}
							onDelete={() => removeAttachment(i)}
							key={upload.id}
							isAny={isAny}
						/>
					))}
				</Group>
			</div>
		</Group>
	);
}
