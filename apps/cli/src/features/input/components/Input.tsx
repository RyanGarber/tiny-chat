import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useState } from "react";
import { TextArea } from "react-ink-textarea";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import { useCommands } from "../hooks/useCommands.ts";
import { useInputStore } from "../stores/useInputStore.ts";
import Completions from "./Completions.tsx";

export default function Input() {
	const statuses = useAppStore((state) => state.statuses);
	const { config } = useConfig();
	const { sendMessage } = useMessaging();

	const content = useInputStore((state) => state.content);
	const setContent = useInputStore((state) => state.setContent);

	const [cursor, setCursor] =
		useState<
			Parameters<NonNullable<Parameters<typeof TextArea>[0]["onCursorChange"]>>
		>();

	const { commands, executeCommand } = useCommands({
		content,
		setContent,
		cursor: cursor?.[0],
	});

	return (
		<>
			{commands.length > 0 && (
				<Completions items={commands} onSelect={executeCommand} />
			)}
			<TextArea
				focus={statuses.length === 0}
				value={content}
				onChange={(value) => {
					queueMicrotask(() => {
						// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal hell
						setContent(value.replace(/\x1b?\[<(\d+);(\d+);(\d+)[Mm]/g, ""));
					});
				}}
				onSubmit={() => sendMessage.mutate()}
				onCursorChange={(...cursor) => setCursor(cursor)}
				disableArrowNavigation={commands.length > 0}
				viewportLines={1}
				placeholder={`Send a message${config?.model ? ` to ${config.model}` : ""}`}
			/>
		</>
	);
}
