import { useState } from "react";
import { TextArea } from "react-ink-textarea";
import { useStatusStore } from "../../../core/stores/useStatusStore.ts";
import { useCommands } from "../hooks/useCommands.ts";
import { useInput } from "../hooks/useInput.ts";
import { useInputStore } from "../stores/useInputStore.ts";
import Completions from "./Completions.tsx";

export default function Input() {
	const { send } = useInput();

	const statuses = useStatusStore((state) => state.statuses);

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
				onSubmit={() => send.mutate()}
				onCursorChange={(...cursor) => setCursor(cursor)}
				disableArrowNavigation={commands.length > 0}
				placeholder="Send a message or try /help"
			/>
		</>
	);
}
