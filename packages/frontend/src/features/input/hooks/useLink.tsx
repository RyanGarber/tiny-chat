import { Anchor } from "@mantine/core";
import { Link as _Link } from "@tiptap/extension-link";
import { MarkViewContent, ReactMarkViewRenderer } from "@tiptap/react";
import { openExternal } from "#frontend/utils/api.ts";

const Link = _Link
	.configure({
		isAllowedUri: () => false,
	})
	.extend({
		addMarkView: () =>
			ReactMarkViewRenderer(({ mark }) => (
				<Anchor
					className="wrap-anywhere font-medium text-primary underline"
					onClick={(e) => {
						if (!mark.attrs.href) return;
						e.preventDefault();
						void openExternal(mark.attrs.href);
					}}
				>
					<MarkViewContent />
				</Anchor>
			)),
	});

export const useLink = () => {
	return Link;
};
