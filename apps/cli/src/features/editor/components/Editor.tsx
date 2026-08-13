import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useDisabled } from "@tiny-chat/client/src/features/editor/hooks/useDisabled.ts";
import { useCompletionStore } from "@tiny-chat/client/src/features/editor/stores/useCompletionStore.ts";
import { useMessages } from "@tiny-chat/client/src/features/message/hooks/useMessages.ts";
import { Box, useInput } from "ink";
import { useContext, useMemo, useState } from "react";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import { StdinUtils } from "../../../core/utils/StdinUtils.ts";
import { useEditorStore } from "../stores/useEditorStore.ts";
import { type EditorSelection, EditorUtils } from "../utils/EditorUtils.ts";
import Attachments from "./Attachments.tsx";
import Commands from "./Commands.tsx";
import Textarea from "./Textarea.tsx";
import TokenUsage from "./TokenUsage.tsx";

/** Rows the editor holds on to while it is empty. */
const LINE_COUNT = 1;

export default function Editor({ disabled: _disabled }: { disabled: boolean }) {
	const { colorScheme } = useContext(ThemeContext);

	const { disabled } = useDisabled({ disabled: _disabled });
	const { config, modelArgs } = useConfig();
	const { sendMessage } = useMessaging();
	const { messages } = useMessages();
	useWorkingStatus(messages, sendMessage);

	const content = useEditorStore((state) => state.content);
	const setContent = useEditorStore((state) => state.setContent);

	const [cursor, setCursor] = useState<[row: number, column: number]>([0, 0]);
	const [selection, setSelection] = useState<EditorSelection | null>(null);

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

	const labels = useMemo(() => EditorUtils.tokenLabels(), []);

	const offset = EditorUtils.offset(content, cursor);

	// A command or an attachment next to the cursor, or around it, goes as one.
	const backward = EditorUtils.deletion(content, offset, -1);
	const forward = EditorUtils.deletion(content, offset, 1);

	// The range Alt takes out, which stops against a command or an attachment
	// rather than cutting a word out of the middle of one.
	const backwardWord = EditorUtils.wordDeletion(content, offset, -1);
	const forwardWord = EditorUtils.wordDeletion(content, offset, 1);

	const remove = ([start, end]: [start: number, end: number]) => {
		setContent(content.slice(0, start) + content.slice(end));
		setCursor(EditorUtils.cursor(content, start));
	};

	// The text area deletes a character at a time, so the keys that would take
	// out a whole command or attachment are taken from it and answered here.
	useInput(
		(_input, key) => {
			if (selection || key.meta) return;

			if (key.backspace && backward) remove(backward);
			if (key.delete && forward) remove(forward);
		},
		{ isActive: !disabled },
	);

	// Alt and a delete, which the text area answers by taking out the word before
	// the cursor however the delete was pressed — cutting into a command or an
	// attachment rather than taking it whole. Taken from it altogether, so both
	// directions are answered the same way and by the same word the arrows step.
	useInput(
		(_input, key) => {
			if (selection || !key.meta) return;

			if (key.backspace) remove(backwardWord);
			else if (key.delete) remove(forwardWord);
		},
		{ isActive: !disabled },
	);

	// Likewise the arrows, which are made to step over a command or an
	// attachment whole so the cursor never comes to rest inside one. Shift is
	// left to the text area, which stretches the selection by it instead.
	useInput(
		(_input, key) => {
			if (key.meta || key.shift || selection) return;
			if (isCompletionsOpen && !isCompletionsEmpty) return;
			if (!key.leftArrow && !key.rightArrow) return;

			const target = EditorUtils.step(content, offset, key.leftArrow ? -1 : 1);
			if (target !== null) setCursor(EditorUtils.cursor(content, target));
		},
		{ isActive: !disabled },
	);

	// Word motion, which terminals send in two different shapes: an arrow under
	// Alt, where the modifiers are encoded into the sequence, and the Emacs
	// Alt+B and Alt+F — which is what macOS Terminal sends for Option and an
	// arrow, whether or not Option is sent as Meta. Both are answered here
	// rather than in the text area, so the cursor is snapped past a command or
	// an attachment whichever shape the press arrived in.
	//
	// Shift is left to the text area, which selects by the word under it — as is
	// the escaped arrow a terminal that cannot report Shift sends in its place,
	// which reaches here as an arrow under Alt like any other.
	useInput(
		(input, key) => {
			if (!key.meta || key.shift) return;
			if (StdinUtils.isEscapedArrow()) return;
			if (isCompletionsOpen && !isCompletionsEmpty) return;

			const isBackward = key.leftArrow || input === "b";
			const isForward = key.rightArrow || input === "f";
			if (!isBackward && !isForward) return;

			const target = isBackward
				? EditorUtils.wordStart(content, offset)
				: EditorUtils.wordEnd(content, offset);

			setCursor(
				EditorUtils.cursor(content, EditorUtils.snap(content, target, offset)),
			);
		},
		{ isActive: !disabled },
	);

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
			<Box
				alignItems="flex-end"
				gap={1}
				paddingX={2}
				paddingY={1}
				backgroundColor={colorScheme.surface}
				flexShrink={0}
			>
				<Textarea
					focus={!disabled}
					value={content}
					onChange={setContent}
					onSubmit={() => sendMessage.mutate()}
					cursor={cursor}
					onCursorChange={setCursor}
					selection={selection}
					onSelectionChange={setSelection}
					// A command or an attachment is only ever selected whole.
					snap={(target, from) => EditorUtils.snap(content, target, from)}
					expand={(selected) => EditorUtils.expand(content, selected)}
					// Word motion and word deletion are answered above, where a
					// command or an attachment is stepped over and taken whole.
					keybindings={{
						Enter: !isCompletionsOpen,
						Backspace: !backward,
						Delete: !forward,
						"Alt+Backspace": false,
						"Alt+B": false,
						"Alt+F": false,
					}}
					disableArrowNavigation={isCompletionsOpen && !isCompletionsEmpty}
					initialLineCount={LINE_COUNT}
					autoNewLineLimit={0}
					highlightActiveLine={true}
					labels={labels}
					styles={{
						command: { color: colorScheme.primary, bold: true },
						attachment: { color: colorScheme.primary, bold: true },
					}}
					placeholder={placeholder}
				/>
				<TokenUsage />
			</Box>
		</>
	);
}
