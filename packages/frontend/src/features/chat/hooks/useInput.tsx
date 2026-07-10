import { useHotkeys } from "@mantine/hooks";
import { Markdown } from "@tiptap/markdown";
import { type JSONContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useLayoutStore } from "#frontend/core/stores/useLayoutStore.tsx";
import {
	BlockquoteNode,
	CodeBlockNode,
	DocumentNode,
	QuoteNode,
} from "#frontend/features/chat/components/InputComponents.tsx";
import { useMessaging } from "#frontend/features/chat/hooks/useMessaging.ts";
import { useUploads } from "#frontend/features/uploads/hooks/useUploads.ts";
import { useInputStore } from "../stores/useInputStore";

const TEST_CONTENT =
	':::quote{model="claude-sonnet-5"}\n**Quote** from Claude Sonnet 5.\n:::';

export const useInput = ({
	ref,
}: {
	ref: RefObject<HTMLDivElement | null>;
}) => {
	const setEditor = useInputStore((s) => s.setEditor);
	const isMobile = useLayoutStore((s) => s.isMobile);

	const { upload } = useUploads();
	const { sendMessage } = useMessaging();

	const [isMultiline, setMultiline] = useState(false);
	const wasEmpty = useRef(true);

	const editor = useEditor({
		editorProps: {
			handlePaste: (_view, event) => {
				let uploaded = false;
				for (const item of event.clipboardData?.items ?? []) {
					if (item.kind === "file") {
						const file = item.getAsFile();
						if (file) {
							upload.mutate({ type: "ATTACHMENT", file });
							uploaded = true;
						}
					}
				}
				return uploaded;
			},
			handleKeyDown: (_view, event) => {
				const mod = event.ctrlKey || event.metaKey;
				if (
					event.key === "Enter" &&
					(isMobile ? !mod && !event.shiftKey : mod)
				) {
					void sendMessage.mutate();
					return true;
				}
			},
		},
		extensions: [
			StarterKit.configure({
				document: false,
				blockquote: false,
				codeBlock: false,
			}),
			Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
			DocumentNode,
			BlockquoteNode,
			CodeBlockNode,
			QuoteNode,
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
			useInputStore.getState().setIsEmpty();
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

	const _keyup = useInputStore((s) => s._keyup);
	useHotkeys([
		["mod+/", () => editor.commands.focus()],
		["/", () => editor.commands.focus()],
		["]", () => _keyup()],
		[
			"\\",
			() => {
				console.log("[  >]", TEST_CONTENT);
				editor.commands.setContent(TEST_CONTENT, { contentType: "markdown" });
				console.log("[ - ]", editor.getJSON());
				console.log("[<  ]", editor.getMarkdown());
			},
		],
	]);

	return { editor, isMultiline };
};
