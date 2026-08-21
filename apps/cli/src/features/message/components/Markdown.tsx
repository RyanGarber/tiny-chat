import { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import {
	processor,
	useMarkdown,
} from "@tiny-chat/client/src/features/message/hooks/useMarkdown.ts";
import { useMarkdownBlocks } from "@tiny-chat/client/src/features/message/hooks/useMarkdownBlocks.ts";
import type { ColorName } from "chalk";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, memo } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import Box from "../../../core/components/Box.tsx";
import { MarkdownComponents } from "./MarkdownComponents.tsx";

const EMPTY: MarkdownContext<never, ColorName> = {};

/**
 * One top-level markdown block.
 *
 * The memo is the point of the split: while a message streams, only the last
 * block's source changes, so every block above it keeps its element tree, and
 * with it the Ink nodes and the layout Yoga already measured for them.
 */
const MarkdownBlock = memo(({ source }: { source: string }) =>
	toJsxRuntime(processor.runSync(processor.parse(source)), {
		Fragment,
		components: MarkdownComponents,
		jsx,
		jsxs,
		ignoreInvalidStyle: true,
		passKeys: true,
		passNode: true,
	}),
);

export default memo(function Markdown({
	source,
	context = EMPTY,
}: {
	source: string;
	context?: MarkdownContext<never, ColorName>;
}) {
	const { content } = useMarkdown({ source });
	const blocks = useMarkdownBlocks({ content, streaming: context.streaming });

	return (
		<MarkdownContext value={context}>
			<Box flexDirection="column" gap={1}>
				{blocks.map((block, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: blocks stay in order
					<MarkdownBlock key={index} source={block} />
				))}
			</Box>
		</MarkdownContext>
	);
});
