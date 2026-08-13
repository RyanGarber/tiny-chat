import { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { useMarkdown } from "@tiny-chat/client/src/features/message/hooks/useMarkdown.ts";
import type { ColorName } from "chalk";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Box } from "ink";
import { Fragment, useMemo } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { MarkdownComponents } from "./MarkdownComponents.tsx";

export default function Markdown({
	source,
	context = {},
}: {
	source: string;
	context?: MarkdownContext<never, ColorName>;
}) {
	const { processor, content } = useMarkdown({
		source,
		withRemend: context?.streaming,
	});

	const tree = useMemo(() => {
		return toJsxRuntime(processor.runSync(processor.parse(content)), {
			Fragment,
			components: MarkdownComponents,
			jsx,
			jsxs,
			ignoreInvalidStyle: true,
			passKeys: true,
			passNode: true,
		});
	}, [processor, content]);

	return (
		<MarkdownContext value={context}>
			<Box flexDirection="column" gap={1}>
				{tree}
			</Box>
		</MarkdownContext>
	);
}
