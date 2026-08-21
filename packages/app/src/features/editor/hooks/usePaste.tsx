import {
	Node,
	NodeViewContent,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";
import PasteView from "#app/features/part/components/Paste.tsx";

const Paste = Node.create({
	name: "pasteBlock",
	group: "block",
	content: "block+",
	atom: true,
	isolating: true,
	draggable: true,
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
		return ReactNodeViewRenderer(({ node }) => (
			<NodeViewWrapper contentEditable={false} data-drag-handle>
				<PasteView
					lines={node.attrs.lines as string | undefined}
					mounted
					grabbable
				>
					<NodeViewContent />
				</PasteView>
			</NodeViewWrapper>
		));
	},
});

export const usePaste = () => {
	return Paste;
};
