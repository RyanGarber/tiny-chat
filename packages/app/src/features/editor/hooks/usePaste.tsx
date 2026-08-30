import {
	Node,
	NodeViewContent,
	NodeViewWrapper,
	type ReactNodeViewProps,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { useEffect, useRef } from "react";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";
import PasteView from "#app/features/part/components/Paste.tsx";

function PasteNodeView({ node }: ReactNodeViewProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let cancelled = false;

		// ReactRenderer flushes the first node-view render before ReactNodeView has
		// created its ProseMirror contentDOM. Tiptap therefore appends contentDOM
		// beside the wrapper, and the initial NodeViewContent ref cannot move it
		// because it ran too early. Move it after that constructor completes.
		queueMicrotask(() => {
			const wrapper = wrapperRef.current;
			if (cancelled || !wrapper) return;
			const root = wrapper.parentElement;
			if (!root) return;

			const target = wrapper.querySelector<HTMLElement>(
				"[data-node-view-content]",
			);
			const content = Array.from(root.children).find(
				(child): child is HTMLElement =>
					child instanceof HTMLElement &&
					child.hasAttribute("data-node-view-content-react"),
			);
			if (target && content && content.parentElement !== target) {
				target.appendChild(content);
			}
		});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<NodeViewWrapper
			ref={wrapperRef}
			className="paste-node-view"
			contentEditable={false}
		>
			<PasteView
				lines={node.attrs.lines as string | undefined}
				mounted
				grabbable
			>
				<NodeViewContent contentEditable={false} />
			</PasteView>
		</NodeViewWrapper>
	);
}

const Paste = Node.create({
	name: "pasteBlock",
	group: "block",
	content: "block+",
	atom: true,
	isolating: true,
	draggable: true,
	extendNodeSchema() {
		return { disableDropCursor: true };
	},
	addAttributes() {
		return {
			lines: {
				default: null,
				parseHTML(element) {
					return element.getAttribute("lines");
				},
				renderHTML(attributes) {
					return attributes.lines ? { lines: attributes.lines } : {};
				},
			},
		};
	},
	parseHTML() {
		return [{ tag: "paste" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["paste", HTMLAttributes, 0];
	},
	...NodeUtils.createContainerDirective({
		nodeName: "pasteBlock",
		name: "paste",
		content: "block",
	}),
	addNodeView() {
		return ReactNodeViewRenderer(PasteNodeView);
	},
});

export const usePaste = () => {
	return Paste;
};
