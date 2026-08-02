import { Document as _Document } from "@tiptap/extension-document";

const Document = _Document.extend({
	renderMarkdown: (node, h) => {
		if (!node.content) return "";
		return h.renderChildren(node.content, "\n");
	},
});

export const useDocument = () => {
	return Document;
};
