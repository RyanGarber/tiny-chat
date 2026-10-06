import {
	Node,
	NodeViewWrapper,
	type ReactNodeViewProps,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { useEditorPartStore } from "#client/features/editor/stores/useEditorPartStore.ts";
import Code from "#gui/features/code/components/Code.tsx";
import { NodeUtils } from "#gui/features/editor/utils/NodeUtils.ts";
import Markdown from "#gui/features/message/components/Markdown.tsx";
import PasteView from "#gui/features/part/components/Paste.tsx";

function PasteNodeView({ node }: ReactNodeViewProps) {
	const paste = useEditorPartStore((state) => state.parts[node.attrs.id]);
	if (paste?.type !== "paste") return null;

	return (
		<NodeViewWrapper
			className="paste-node-view"
			contentEditable={false}
			data-drag-handle
		>
			<PasteView lines={String(paste.lines)} grabbable>
				{paste.language ? (
					<Code code={paste.text} language={paste.language} />
				) : (
					<Markdown source={paste.text} />
				)}
			</PasteView>
		</NodeViewWrapper>
	);
}

const Paste = Node.create({
	name: "pasteBlock",
	group: "block",
	atom: true,
	isolating: true,
	draggable: true,
	extendNodeSchema() {
		return { disableDropCursor: true };
	},
	addAttributes() {
		return {
			id: {
				default: null,
				parseHTML(element) {
					return element.getAttribute("id");
				},
				renderHTML(attributes) {
					return { id: attributes.id };
				},
			},
		};
	},
	parseHTML() {
		return [{ tag: "paste" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["paste", HTMLAttributes];
	},
	...NodeUtils.createPartMarker({ nodeName: "pasteBlock", type: "paste" }),
	addNodeView() {
		return ReactNodeViewRenderer(PasteNodeView);
	},
});

export const usePaste = () => {
	return Paste;
};
