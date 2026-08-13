import { Box } from "@mantine/core";
import { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { useMarkdown } from "@tiny-chat/client/src/features/message/hooks/useMarkdown.ts";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import { type ComponentProps, memo, useMemo } from "react";
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
const MarkdownBlock = memo(
	({
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
	}) => (
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
	),
);

export const Markdown = memo(
	({
		source,
		context = {},
		maw,
	}: {
		source: string;
		context?: MarkdownContext<string>;
		maw?: number;
	}) => {
		const { theme, codeTheme } = useThemes();
		const { remarkPlugins, rehypePlugins, content } = useMarkdown({
			source,
			withKatex: true,
		});

		const markdownContext = useMemo(
			(): MarkdownContext => ({ ...context, theme, codeTheme }),
			[context, theme, codeTheme],
		);

		/**
		 * Split once here rather than letting a single Streamdown instance do it
		 * internally. Feeding it the whole document meant every token re-ran
		 * remend and the marked lexer over everything already on screen and walked
		 * the full block list, which is what made per-token cost grow with message
		 * length. This is the same splitter Streamdown uses, so block boundaries —
		 * including the cases it refuses to split, such as footnotes — are
		 * unchanged.
		 */
		const blocks = useMemo(
			() =>
				// The splitter emits the blank lines between blocks as blocks of their
				// own. Inside one Streamdown instance those render to nothing, but here
				// each would take a wrapper of its own and a slot in the spacing rule.
				// Dropping them is safe because every block is parsed independently.
				parseMarkdownIntoBlocks(content).filter(
					(block) => block.trim().length > 0,
				),
			[content],
		);

		const streaming = context.streaming ?? false;

		return (
			<MarkdownContext value={markdownContext}>
				<Box
					maw={maw}
					style={{ overflowWrap: "break-word" }}
					className={[
						"space-y-4",
						context.style?.textSize ? `**:${context.style?.textSize}` : "",
					]
						.filter(Boolean)
						.join(" ")}
				>
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
			</MarkdownContext>
		);
	},
	(previous, next) =>
		previous.source === next.source &&
		previous.context?.style === next.context?.style &&
		previous.context?.streaming === next.context?.streaming &&
		previous.maw === next.maw,
);
