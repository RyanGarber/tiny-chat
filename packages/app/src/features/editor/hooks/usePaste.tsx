import { useEditorPartStore } from "@tiny-chat/client/src/features/editor/stores/useEditorPartStore.ts";
import {
	Node,
	NodeViewWrapper,
	type ReactNodeViewProps,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import Code from "#app/features/code/components/Code.tsx";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";
import PasteView from "#app/features/part/components/Paste.tsx";

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
				<Code code={paste.text} language={paste.language ?? undefined} />
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
	...NodeUtils.createPointerDirective({
		nodeName: "pasteBlock",
		name: "paste",
	}),
	addNodeView() {
		return ReactNodeViewRenderer(PasteNodeView);
	},
});

export const usePaste = () => {
	return Paste;
};
