import { useState } from "react";
import { TextArea } from "react-ink-textarea";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import { useCommands } from "../hooks/useCommands.ts";
import { InputService } from "../services/InputService.ts";
import { useInputStore } from "../stores/useInputStore.ts";
import Completions from "./Completions.tsx";

export default function Input() {
	const statuses = useAppStore((state) => state.statuses);

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
				onSubmit={() => console.log("[send]", InputService.getData())}
				onCursorChange={(...cursor) => setCursor(cursor)}
				disableArrowNavigation={commands.length > 0}
				viewportLines={1}
				placeholder="Send a message or try /help"
			/>
		</>
	);
}
