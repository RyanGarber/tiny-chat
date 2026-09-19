import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { MessagingService } from "@tiny-chat/client/src/features/chat/services/MessagingService.ts";
import { useMessagingStore } from "@tiny-chat/client/src/features/chat/stores/useMessagingStore.ts";
import { useDisabled } from "@tiny-chat/client/src/features/editor/hooks/useDisabled.ts";
import type {
	Categories,
	Usage,
} from "@tiny-chat/client/src/features/editor/hooks/useEstimatedTokens.ts";
import { AttachmentService } from "@tiny-chat/client/src/features/editor/services/AttachmentService.ts";
import { useAtomStore } from "@tiny-chat/client/src/features/editor/stores/useAtomStore.ts";
import { useCompletionStore } from "@tiny-chat/client/src/features/editor/stores/useCompletionStore.ts";
import { AtomUtils } from "@tiny-chat/client/src/features/editor/utils/AtomUtils.ts";
import { EditorNodeUtils } from "@tiny-chat/client/src/features/editor/utils/EditorNodeUtils.ts";
import { useMessages } from "@tiny-chat/client/src/features/message/hooks/useMessages.ts";
import { useMessageStore } from "@tiny-chat/client/src/features/message/stores/useMessageStore.ts";
import { useUploads } from "@tiny-chat/client/src/features/upload/hooks/useUploads.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useInput, usePaste, useWindowSize } from "ink";
import { useContext, useEffect, useMemo } from "react";
import { client } from "../../../client.ts";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import type { Color } from "../../../core/hooks/useColor.ts";
import { useMouseInput } from "../../../core/hooks/useMouseInput.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import { ClipboardService } from "../../../core/services/ClipboardService.ts";
import { StdinUtils } from "../../../core/utils/StdinUtils.ts";
import { useEditorStore } from "../stores/useEditorStore.ts";
import { EditorUtils } from "../utils/EditorUtils.ts";
import { FilePasteUtils } from "../utils/FilePasteUtils.ts";
import { MarkdownUtils, type MarkdownWrite } from "../utils/MarkdownUtils.ts";
import Attachments from "./Attachments.tsx";
import Commands from "./Commands.tsx";
import Textarea from "./Textarea.tsx";
import TokenUsage from "./TokenUsage.tsx";

/** Rows the editor holds on to while it is empty. */
const LINE_COUNT = 1;

export default function Editor({
	disabled: _disabled,
	usage,
	categories,
}: {
	disabled: boolean;
	usage: Usage<Color>;
	categories: Categories;
}) {
	const { colorScheme } = useContext(ThemeContext);
	const { columns } = useWindowSize();

	const focusedFeedbackId = useEditorStore((s) => s.focusedFeedbackId);
	const nextFeedbackId = useMessageStore((s) => s.nextFeedbackId);
	const feedbackFocused =
		!!nextFeedbackId && focusedFeedbackId === nextFeedbackId;
	const { disabled } = useDisabled({ disabled: _disabled || feedbackFocused });
	const { mouseRef: focusRef } = useMouseInput({
		onClick: () => useEditorStore.setState({ focusedFeedbackId: null }),
	});
	useInput(
		(_, key) => {
			if (key.tab && nextFeedbackId)
				useEditorStore.setState({
					focusedFeedbackId: feedbackFocused ? null : nextFeedbackId,
				});
		},
		{ isActive: !_disabled },
	);
	const { config, modelArgs } = useConfig();
	const { sendMessage } = useMessaging();
	const { messages } = useMessages();
	const { upload } = useUploads();
	useWorkingStatus(messages, sendMessage, upload);

	const content = useEditorStore((state) => state.content);
	const setContent = useEditorStore((state) => state.setContent);

	// The commands, the attachments and the pastes standing in the value, each
	// of which is drawn, stepped over and taken out whole.
	const atoms = useAtomStore((state) => state.atoms);

	const cursor = useEditorStore((state) => state.cursor);
	const setCursor = useEditorStore((state) => state.setCursor);
	const insertAt = useEditorStore((state) => state.insert);

	const selection = useEditorStore((state) => state.selection);
	const setSelection = useEditorStore((state) => state.setSelection);

	const isCompletionsOpen = useCompletionStore(
		(state) => state.isCompletionsOpen,
	);
	const isCompletionsEmpty = useCompletionStore(
		(state) => state.isCompletionsEmpty,
	);

	const activeFolder = useMessagingStore((state) => state.activeFolder);
	const placeholder = useMemo(() => {
		if (!config)
			return activeFolder ? activeFolder.title || "Untitled" : "/folders";
		return [
			activeFolder ? activeFolder.title || "Untitled" : "/folders",
			config.model,
			...modelArgs.map(
				(arg) => `${arg.name} ${config.args?.[arg.name] ?? arg.default}`,
			),
		]
			.join(" · ")
			.slice(0, columns - 10);
	}, [config, modelArgs, columns, activeFolder]);

	// The atoms are painted before the markdown, so a command or an attachment
	// standing in the value keeps its own style whatever punctuation it carries.
	const labels = useMemo(
		() => [...EditorUtils.tokenLabels({ atoms }), ...MarkdownUtils.labels()],
		[atoms],
	);

	const styles = useMemo(
		() => ({
			...MarkdownUtils.styles(colorScheme),
			command: { color: colorScheme.primary, bold: true },
			attachment: { color: colorScheme.primary, bold: true },
			paste: { color: colorScheme.textSubtle, bold: true },
		}),
		[colorScheme],
	);

	// The content and its atoms are what the editor holds, but the message
	// being written is what every other reader wants — so it is kept in step
	// here, the way the app keeps its own editor's `zData` in step on update.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-read on every change to what the editor holds
	useEffect(() => {
		MessagingService.getData({ client });
	}, [content, atoms]);

	const offset = EditorUtils.offset(content, cursor);

	// A command, an attachment or a paste next to the cursor, or around it, goes
	// as one.
	const backward = EditorUtils.deletion({
		value: content,
		atoms,
		offset,
		direction: -1,
	});
	const forward = EditorUtils.deletion({
		value: content,
		atoms,
		offset,
		direction: 1,
	});

	// The range Alt takes out, which stops against an atom rather than cutting a
	// word out of the middle of one.
	const backwardWord = EditorUtils.wordDeletion({
		value: content,
		atoms,
		offset,
		direction: -1,
	});
	const forwardWord = EditorUtils.wordDeletion({
		value: content,
		atoms,
		offset,
		direction: 1,
	});

	const remove = ([start, end]: [start: number, end: number]) => {
		setContent(content.slice(0, start) + content.slice(end));
		setCursor(EditorUtils.cursor(content, start));
	};

	/** Writes content in whole, with the cursor left where the write leaves it. */
	const write = ({ content: next, offset: to }: MarkdownWrite) => {
		setContent(next);
		setCursor(EditorUtils.cursor(next, to));
	};

	// A markdown marker closes itself as it is opened, which the text area knows
	// nothing of: it writes the one character it was handed, and the write that
	// should have been made in its place is put in here instead.
	const handleChange = (next: string) => {
		const isTyped =
			!selection &&
			next.length === content.length + 1 &&
			next.slice(0, offset) === content.slice(0, offset) &&
			next.slice(offset + 1) === content.slice(offset);

		const marked = isTyped
			? MarkdownUtils.marked({ value: content, offset, marker: next[offset] })
			: null;

		if (marked) write(marked);
		else setContent(next);
	};

	/** Writes text in at the cursor, over whatever is selected. */
	const insert = (text: string) => {
		insertAt(text, selection ? EditorUtils.range(selection) : undefined);
		setSelection(null);
	};

	// A paste arrives whole rather than a key at a time, which is what lets a
	// long one be collapsed into an atom instead of filling the editor with it.
	// Terminals send their newlines as carriage returns, which the value holds
	// as line feeds.
	const paste = (text: string) => {
		const pasted = text.replace(/\r\n?/g, "\n");
		if (!pasted) return;

		// A file dragged onto a macOS terminal arrives as its escaped path
		// rather than its contents, so it is attached instead of dumped in as
		// text.
		const files = FilePasteUtils.detect(pasted);
		if (files) {
			void Promise.all(
				files.map((file) =>
					AttachmentService.create({
						client,
						item: {
							name: PathUtils.name(file.path),
							value: file.path,
							directory: file.directory,
						},
					}),
				),
			).then((nodes) => {
				insert(
					nodes
						.map((node) => `${AtomUtils.fromNode({ content, node })} `)
						.join(""),
				);
			});
			return;
		}

		const node = EditorNodeUtils.paste(pasted);
		insert(node ? AtomUtils.fromNode({ content, node }) : pasted);
	};

	usePaste(paste, { isActive: !disabled });

	// An image on the clipboard never reaches stdin: the terminal drops it, and
	// a paste either arrives empty or carries the file's name instead. Ctrl+V
	// goes to the clipboard itself, which is the only way to reach one — and
	// stands in for the paste altogether on terminals that cannot bracket one.
	useInput(
		(input, key) => {
			if (!key.ctrl || input !== "v") return;

			void (async () => {
				const clipboard = await ClipboardService.read();
				if (!clipboard) return;

				if (clipboard.type === "text") {
					paste(clipboard.text);
					return;
				}

				const name = `Pasted-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
				upload.mutate({
					kind: "ATTACHMENT",
					file: new File([clipboard.data], name, { type: "image/png" }),
				});
			})();
		},
		{ isActive: !disabled },
	);

	// The text area deletes a character at a time, so the keys that would take
	// out a whole atom are taken from it and answered here.
	useInput(
		(_input, key) => {
			if (selection || key.meta) return;

			if (key.backspace && backward) remove(backward);
			if (key.delete && forward) remove(forward);
		},
		{ isActive: !disabled },
	);

	// Alt and a delete, which the text area answers by taking out the word before
	// the cursor however the delete was pressed — cutting into an atom rather
	// than taking it whole. Taken from it altogether, so both directions are
	// answered the same way and by the same word the arrows step.
	useInput(
		(_input, key) => {
			if (selection || !key.meta) return;

			if (key.backspace) remove(backwardWord);
			else if (key.delete) remove(forwardWord);
		},
		{ isActive: !disabled },
	);

	// Likewise the arrows, which are made to step over an atom whole so the
	// cursor never comes to rest inside one. Shift is left to the text area,
	// which stretches the selection by it instead.
	useInput(
		(_input, key) => {
			if (key.meta || key.shift || selection) return;
			if (isCompletionsOpen && !isCompletionsEmpty) return;
			if (!key.leftArrow && !key.rightArrow) return;

			const target = EditorUtils.step({
				value: content,
				atoms,
				offset,
				direction: key.leftArrow ? -1 : 1,
			});
			if (target !== null) setCursor(EditorUtils.cursor(content, target));
		},
		{ isActive: !disabled },
	);

	// Word motion, which terminals send in two different shapes: an arrow under
	// Alt, where the modifiers are encoded into the sequence, and the Emacs
	// Alt+B and Alt+F — which is what macOS Terminal sends for Option and an
	// arrow, whether or not Option is sent as Meta. Both are answered here
	// rather than in the text area, so the cursor is snapped past an atom
	// whichever shape the press arrived in.
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
				EditorUtils.cursor(
					content,
					EditorUtils.snap({
						value: content,
						atoms,
						offset: target,
						from: offset,
					}),
				),
			);
		},
		{ isActive: !disabled },
	);

	useInput(
		(_, key) => {
			if (!key.meta || key.shift) return;
			if (isCompletionsOpen && !isCompletionsEmpty) return;
			if (!key.return) return;

			sendMessage.mutate();
		},
		{ isActive: !disabled },
	);

	return (
		<>
			{nextFeedbackId && (
				<Text color="textSubtle">
					{" "}
					Tab: {feedbackFocused ? "message editor" : "tool feedback"}
				</Text>
			)}
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
				ref={(element) => focusRef(element, 0)}
				alignItems="flex-end"
				paddingX={2}
				paddingY={1}
				backgroundColor="surface"
			>
				<Textarea
					focus={!disabled}
					value={content}
					onChange={handleChange}
					cursor={cursor}
					onCursorChange={setCursor}
					selection={selection}
					onSelectionChange={setSelection}
					// An atom is only ever selected whole.
					snap={(target, from) =>
						EditorUtils.snap({ value: content, atoms, offset: target, from })
					}
					expand={(selected) =>
						EditorUtils.expand({ value: content, atoms, selection: selected })
					}
					// Word motion and word deletion are answered above, where an atom
					// is stepped over and taken whole.
					//
					// A newline carries the block it was pressed in on — a list keeps
					// its bullet, a quote its marker — rather than starting a bare line.
					onSubmit={() => {
						const broken = selection
							? null
							: MarkdownUtils.broken({ value: content, offset });

						if (broken) write(broken);
						else insert("\n");
					}}
					keybindings={{
						Enter: !isCompletionsOpen,
						"Shift+Enter": !isCompletionsOpen,
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
					styles={styles}
					placeholder={placeholder}
				/>
				<TokenUsage usage={usage} categories={categories} />
			</Box>
		</>
	);
}
