import { useEditorPartStore } from "@tiny-chat/client/src/features/editor/stores/useEditorPartStore.ts";
import { Blockquote as _Blockquote } from "@tiptap/extension-blockquote";
import {
	Node,
	NodeViewContent,
	NodeViewWrapper,
	type ReactNodeViewProps,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";
import Quote from "#app/features/part/components/Quote.tsx";

function QuoteNodeView({ node }: ReactNodeViewProps) {
	const quote = useEditorPartStore((state) => state.parts[node.attrs.id]);
	if (quote?.type !== "quote") return null;

	return (
		<NodeViewWrapper contentEditable={false} data-drag-handle>
			<Quote model={quote.model} className="cursor-grab">
				{quote.text}
			</Quote>
		</NodeViewWrapper>
	);
}

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
					return [{ tag: "quote" }];
				},
				renderHTML({ HTMLAttributes }) {
					return ["quote", HTMLAttributes];
				},
				...NodeUtils.createPointerDirective({ nodeName: "quote" }),
				addNodeView() {
					return ReactNodeViewRenderer(QuoteNodeView);
				},
			}),
		];
	},
});

export const useBlockquote = () => {
	return Blockquote;
};
