import { StreamContext } from "@tiny-chat/client/features/message/components/StreamContext.tsx";
import {
	type MarkdownSource,
	processor,
	useMarkdown,
} from "@tiny-chat/client/features/message/hooks/useMarkdown.ts";
import { useMarkdownBlocks } from "@tiny-chat/client/features/message/hooks/useMarkdownBlocks.ts";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import Box from "../../../core/components/Box.tsx";
import type { Color } from "../../../core/hooks/useColor.ts";
import { MarkdownComponents } from "./MarkdownComponents.tsx";

/**
 * One top-level markdown block.
 *
 * The memo is the point of the split: while a message streams, only the last
 * block's source changes, so every block above it keeps its element tree, and
 * with it the Ink nodes and the layout Yoga already measured for them.
 */
function MarkdownBlock({ source }: { source: string }) {
	return toJsxRuntime(processor.runSync(processor.parse(source)), {
		Fragment,
		components: MarkdownComponents,
		jsx,
		jsxs,
		ignoreInvalidStyle: true,
		passKeys: true,
		passNode: true,
	});
}

export default function Markdown({
	source,
	streaming = false,
	textColor,
}: {
	source: MarkdownSource;
	streaming?: boolean;
	textColor?: Color;
}) {
	const { content } = useMarkdown({ source });
	const blocks = useMarkdownBlocks({ content, streaming });

	// Only the last block can still be growing; the ones above it are final.
	return (
		<Box flexDirection="column" gap={1} color={textColor}>
			{blocks.map((block, index) => (
				<StreamContext
					// biome-ignore lint/suspicious/noArrayIndexKey: blocks stay in order
					key={index}
					value={streaming && index === blocks.length - 1}
				>
					<MarkdownBlock source={block} />
				</StreamContext>
			))}
		</Box>
	);
}
