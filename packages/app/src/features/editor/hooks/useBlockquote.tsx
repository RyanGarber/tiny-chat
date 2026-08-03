import { Blockquote as _Blockquote } from "@tiptap/extension-blockquote";
import {
	Node,
	NodeViewContent,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { Quote } from "#app/core/components/Components.tsx";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";

const Blockquote = _Blockquote.extend({
	addNodeView() {
		return ReactNodeViewRenderer(() => (
			<NodeViewWrapper>
				<Quote>
					<NodeViewContent />
				</Quote>
			</NodeViewWrapper>
		));
	},
	addExtensions() {
		return [
			Node.create({
				name: "quote",
				group: "block",
				content: "block+",
				atom: true,
				isolating: true,
				draggable: true,
				addAttributes() {
					return {
						model: {
							default: null,
							parseHTML(element) {
								return element.getAttribute("model");
							},
							renderHTML(attributes) {
								return { model: attributes.model };
							},
						},
					};
				},
				parseHTML() {
					return [{ tag: "quote" }];
				},
				renderHTML({ HTMLAttributes }) {
					return ["quote", HTMLAttributes, 0];
				},
				...NodeUtils.createContainerDirective({
					nodeName: "quote",
					content: "block",
				}),
				addNodeView() {
					return ReactNodeViewRenderer(({ node }) => (
						<NodeViewWrapper contentEditable={false} data-drag-handle>
							<Quote
								model={node.attrs.model as string}
								style={{ cursor: "grab" }}
							>
								<NodeViewContent />
							</Quote>
						</NodeViewWrapper>
					));
				},
			}),
		];
	},
});

export const useBlockquote = () => {
	return Blockquote;
};
