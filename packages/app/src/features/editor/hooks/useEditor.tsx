import { useHotkeys } from "@mantine/hooks";
import { Markdown } from "@tiptap/markdown";
import { useEditor as _useEditor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useMessaging } from "#client/src/features/chat/hooks/useMessaging.ts";
import { useUploads } from "#client/src/features/upload/hooks/useUploads.ts";
import { UploadType } from "#core/features/file/types/upload";
import { useAttachment } from "../hooks/useAttachment.tsx";
import { useBlockquote } from "../hooks/useBlockquote.tsx";
import { useCodeBlock } from "../hooks/useCodeBlock.tsx";
import { useCommand } from "../hooks/useCommand.tsx";
import { useDocument } from "../hooks/useDocument.tsx";
import { useLink } from "../hooks/useLink.tsx";
import { useEditorStore } from "../stores/useEditorStore.ts";

export const useEditor = ({
	ref,
	disabled,
}: {
	ref: RefObject<HTMLDivElement | null>;
	disabled?: boolean;
}) => {
	const setEditor = useEditorStore((s) => s.setEditor);

	const { upload } = useUploads();
	const { sendMessage } = useMessaging();

	const [isMultiline, setMultiline] = useState(false);
	const wasEmpty = useRef(true);

	const editor = _useEditor({
		editorProps: {
			handlePaste: (_view, event) => {
				let uploaded = false;
				for (const item of event.clipboardData?.items ?? []) {
					if (item.kind === "file") {
						const file = item.getAsFile();
						if (file) {
							upload.mutate({ type: UploadType.ATTACHMENT, file });
							uploaded = true;
						}
					}
				}
				return uploaded;
			},
			handleKeyDown: (_view, event) => {
				if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
					if (event.shiftKey) {
						console.log(editor.getMarkdown());
						return;
					}
					void sendMessage.mutate();
					return true;
				}
			},
		},
		extensions: [
			StarterKit.configure({
				document: false,
				link: false,
				blockquote: false,
				codeBlock: false,
			}),
			Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
			useDocument(),
			useLink(),
			useBlockquote(),
			useCodeBlock(),
			useAttachment(),
			useCommand(),
		],
		coreExtensionOptions: {
			clipboardTextSerializer: {
				blockSeparator: "\n",
			},
		},
		onCreate: ({ editor }) => {
			(
				editor.storage.markdown.manager as unknown as {
					encodeTextForMarkdown: unknown;
					codeTypes: { has: (_: unknown) => boolean };
					escapeMarkdownSyntax: (_: string) => string;
				}
			).encodeTextForMarkdown = function (
				text: string,
				node: JSONContent,
				parentNode?: JSONContent,
			) {
				const isInsideCode =
					(parentNode?.type != null && this.codeTypes.has(parentNode.type)) ||
					(node.marks ?? []).some((m) =>
						this.codeTypes.has(typeof m === "string" ? m : m.type),
					);

				if (isInsideCode) {
					return text;
				}

				return this.escapeMarkdownSyntax(text);
			};
		},
		onUpdate: ({ editor }) => {
			const _isNowEmpty = editor.isEmpty && !wasEmpty.current;
			if (_isNowEmpty) setMultiline(false);
			wasEmpty.current = editor.isEmpty;
			useEditorStore.getState().update();
		},
	});

	useEffect(() => {
		setEditor(editor);
		return () => setEditor(null);
	}, [editor, setEditor]);

	useLayoutEffect(() => {
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			const height = entry.contentRect.height;
			if (height > 40) setMultiline(true);
		});
		if (ref.current) {
			observer.observe(ref.current);
		}
		return () => observer.disconnect();
	}, [ref]);

	useEffect(() => {
		editor.setEditable(!disabled, false);
	}, [editor, disabled]);

	useHotkeys([
		["/", () => editor.commands.focus()],
		["mod+/", () => editor.commands.focus()],
	]);

	return { editor, isMultiline };
};
