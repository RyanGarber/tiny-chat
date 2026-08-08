import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useDisabled } from "@tiny-chat/client/src/features/editor/hooks/useDisabled.ts";
import { useCompletionStore } from "@tiny-chat/client/src/features/editor/stores/useCompletionStore.ts";
import { useMessages } from "@tiny-chat/client/src/features/message/hooks/useMessages.ts";
import { Box } from "ink";
import { useMemo, useState } from "react";
import { TextArea } from "react-ink-textarea";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import { CliUtils } from "../../../core/utils/CliUtils.ts";
import { useEditorStore } from "../stores/useEditorStore.ts";
import Attachments from "./Attachments.tsx";
import Commands from "./Commands.tsx";
import TokenUsage from "./TokenUsage.tsx";

export default function Editor({ disabled: _disabled }: { disabled: boolean }) {
	const { disabled } = useDisabled({ disabled: _disabled });
	const { config, modelArgs } = useConfig();
	const { sendMessage } = useMessaging();
	const { messages } = useMessages();
	useWorkingStatus(messages, sendMessage);

	const content = useEditorStore((state) => state.content);
	const setContent = useEditorStore((state) => state.setContent);

	const [cursor, setCursor] = useState<[row: number, column: number]>([0, 0]);

	const isCompletionsOpen = useCompletionStore(
		(state) => state.isCompletionsOpen,
	);
	const isCompletionsEmpty = useCompletionStore(
		(state) => state.isCompletionsEmpty,
	);

	const placeholder = useMemo(() => {
		if (!config) return "";
		return [
			config.model,
			...modelArgs.map(
				(arg) => `${arg.name} ${config.args?.[arg.name] ?? arg.default}`,
			),
		].join(" · ");
	}, [config, modelArgs]);

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
			<Box alignItems="flex-end" gap={1}>
				<Box flexGrow={1}>
					<TextArea
						focus={!disabled}
						value={content}
						cursorPosition={cursor}
						onChange={(value) => setContent(CliUtils.clean(value))}
						onSubmit={() => sendMessage.mutate()}
						onCursorChange={(position) => setCursor(position)}
						keybindings={{ Enter: !isCompletionsOpen }}
						disableArrowNavigation={isCompletionsOpen && !isCompletionsEmpty}
						initialLineCount={1}
						autoNewLineLimit={0}
						highlightActiveLine={true}
						placeholder={placeholder}
					/>
				</Box>
				<TokenUsage />
			</Box>
		</>
	);
}
