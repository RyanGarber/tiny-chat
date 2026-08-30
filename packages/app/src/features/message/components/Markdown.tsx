import { Box } from "@mantine/core";
import { StreamContext } from "@tiny-chat/client/src/features/message/components/StreamContext.tsx";
import {
	type MarkdownSource,
	useMarkdown,
} from "@tiny-chat/client/src/features/message/hooks/useMarkdown.ts";
import type { ComponentProps } from "react";
import {
	type AnimateOptions,
	parseMarkdownIntoBlocks,
	Streamdown,
} from "streamdown";
import { MarkdownComponents } from "#app/features/message/components/MarkdownComponents.tsx";
import "katex/dist/katex.min.css";

const animated: AnimateOptions = {
	animation: "blurIn",
	duration: 150,
	easing: "ease",
	stagger: 5,
	sep: "word",
};

/**
 * One top-level markdown block.
 *
 * Streamdown's own memo bails out when `children` is unchanged, so a block that
 * has scrolled off the tail of the stream costs nothing on later tokens: no
 * remend pass, no lexer pass, no React walk.
 */
function MarkdownBlock({
	source,
	streaming,
	animating,
	remarkPlugins,
	rehypePlugins,
}: {
	source: string;
	streaming: boolean;
	animating: boolean;
	remarkPlugins: ComponentProps<typeof Streamdown>["remarkPlugins"];
	rehypePlugins: ComponentProps<typeof Streamdown>["rehypePlugins"];
}) {
	return (
		<Streamdown
			animated={animated}
			isAnimating={animating}
			mode={streaming ? "streaming" : "static"}
			components={MarkdownComponents}
			remarkPlugins={remarkPlugins}
			rehypePlugins={rehypePlugins}
			className="selectable"
		>
			{source}
		</Streamdown>
	);
}

export default function Markdown({
	source,
	streaming = false,
}: {
	source: MarkdownSource;
	streaming?: boolean;
}) {
	const { remarkPlugins, rehypePlugins, content } = useMarkdown({
		source,
		withKatex: true,
	});

	/**
	 * Split once here rather than letting a single Streamdown instance do it
	 * internally. Feeding it the whole document meant every token re-ran
	 * remend and the marked lexer over everything already on screen and walked
	 * the full block list, which is what made per-token cost grow with message
	 * length. This is the same splitter Streamdown uses, so block boundaries —
	 * including the cases it refuses to split, such as footnotes — are
	 * unchanged.
	 */
	const blocks = parseMarkdownIntoBlocks(content).filter(
		// The splitter emits the blank lines between blocks as blocks of their
		// own. Inside one Streamdown instance those render to nothing, but here
		// each would take a wrapper of its own and a slot in the spacing rule.
		// Dropping them is safe because every block is parsed independently.
		(block) => block.trim().length > 0,
	);

	return (
		<StreamContext value={streaming}>
			<Box className="space-y-4 wrap-break-word">
				{blocks.map((block, index) => (
					<MarkdownBlock
						// biome-ignore lint/suspicious/noArrayIndexKey: blocks stay in order
						key={index}
						source={block}
						streaming={streaming}
						animating={streaming && index === blocks.length - 1}
						remarkPlugins={remarkPlugins}
						rehypePlugins={rehypePlugins}
					/>
				))}
			</Box>
		</StreamContext>
	);
}
