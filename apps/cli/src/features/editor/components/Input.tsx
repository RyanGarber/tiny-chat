import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useInput } from "ink";
import { useState } from "react";
import { TextArea } from "react-ink-textarea";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import { TerminalUtils } from "../../../core/utils/TerminalUtils.ts";
import { useAttachment } from "../hooks/useAttachment.ts";
import { useCommand } from "../hooks/useCommand.ts";
import { useInputStore } from "../stores/useInputStore.ts";
import Completions from "./Completions.tsx";

export default function Input({ disabled }: { disabled?: boolean }) {
	const statuses = useAppStore((state) => state.statuses);
	const { config } = useConfig();
	const { sendMessage } = useMessaging();

	const content = useInputStore((state) => state.content);
	const setContent = useInputStore((state) => state.setContent);

	const [cursor, setCursor] = useState<[row: number, column: number]>([0, 0]);

	const completions = useCommand({
		content,
		setContent,
		cursor,
		setCursor,
	});
	const attachment = useAttachment({ content, setContent, cursor, setCursor });

	const isFocused = statuses.length === 0 && !disabled;

	const active = completions.isCommanding
		? completions
		: attachment.isAttaching
			? attachment
			: null;

	useInput(
		(_, key) => {
			if (!active) return;
			if (key.upArrow) active.move(-1);
			if (key.downArrow) active.move(1);
			if (key.return && !active.select()) sendMessage.mutate();
		},
		{ isActive: isFocused && !!active },
	);

	return (
		<>
			{active && active.groups.length > 0 && (
				<Completions groups={active.groups} selected={active.selected} />
			)}
			<TextArea
				focus={isFocused}
				value={content}
				cursorPosition={cursor}
				onChange={(value) => setContent(TerminalUtils.clean(value))}
				onSubmit={() => sendMessage.mutate()}
				onCursorChange={(position) => setCursor(position)}
				onTab={() => active?.select({ complete: true })}
				keybindings={{ Enter: !active }}
				disableArrowNavigation={!!active && active.groups.length > 0}
				viewportLines={1}
				placeholder={`Send a message${config?.model ? ` to ${config.model}` : ""}`}
			/>
		</>
	);
}
