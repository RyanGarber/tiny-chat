import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useCompletionStore } from "@tiny-chat/client/src/features/editor/stores/useCompletionStore.ts";
import { useMemo, useState } from "react";
import { TextArea } from "react-ink-textarea";
import { TerminalUtils } from "../../../core/utils/TerminalUtils.ts";
import { useInputStore } from "../stores/useInputStore.ts";
import Attachments from "./Attachments.tsx";
import Commands from "./Commands.tsx";

export default function Input({ disabled }: { disabled?: boolean }) {
	const { config } = useConfig();
	const { sendMessage } = useMessaging();

	const content = useInputStore((state) => state.content);
	const setContent = useInputStore((state) => state.setContent);

	const [cursor, setCursor] = useState<[row: number, column: number]>([0, 0]);

	const isCompletionsOpen = useCompletionStore(
		(state) => state.isCompletionsOpen,
	);
	const isCompletionsEmpty = useCompletionStore(
		(state) => state.isCompletionsEmpty,
	);

	const placeholder = useMemo(() => {
		if (!config) return "";
		return `${config.model} · ${Object.entries(config.args)
			.map(([key, value]) => `${key} ${value}`)
			.join(" · ")}`;
	}, [config]);

	return (
		<>
			<Commands
				content={content}
				setContent={setContent}
				cursor={cursor}
				setCursor={setCursor}
			/>
			<Attachments
				content={content}
				setContent={setContent}
				cursor={cursor}
				setCursor={setCursor}
			/>
			<TextArea
				focus={!disabled}
				value={content}
				cursorPosition={cursor}
				onChange={(value) => setContent(TerminalUtils.clean(value))}
				onSubmit={() => sendMessage.mutate()}
				onCursorChange={(position) => setCursor(position)}
				keybindings={{ Enter: !isCompletionsOpen }}
				disableArrowNavigation={isCompletionsOpen && !isCompletionsEmpty}
				initialLineCount={1}
				autoNewLineLimit={0}
				highlightActiveLine={true}
				placeholder={placeholder}
			/>
		</>
	);
}
