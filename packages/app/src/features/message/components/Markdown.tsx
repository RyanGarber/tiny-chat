import { Box } from "@mantine/core";
import { mermaid } from "@streamdown/mermaid";
import { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { useMarkdown } from "@tiny-chat/client/src/features/message/hooks/useMarkdown.ts";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import { memo, useMemo } from "react";
import {
	type AnimateOptions,
	type Components,
	type PluginConfig,
	Streamdown,
} from "streamdown";
import {
	AComponent,
	BlockquoteComponent,
	CiteComponent,
	LinkComponent,
	SlotComponent,
} from "#app/features/message/components/MarkdownComponents.tsx";

import "katex/dist/katex.min.css";
import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";

const COMPONENTS: Components = {
	blockquote: BlockquoteComponent,
	a: AComponent,
	link: LinkComponent,
	mark: CiteComponent,
	slot: SlotComponent,
};

const ANIMATE_OPTIONS: AnimateOptions = {
	animation: "blurIn",
	duration: 150,
	easing: "ease",
	stagger: 5,
	sep: "word",
};

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
		const { codeTheme, theme } = useThemes();
		const { remarkPlugins, rehypePlugins, content } = useMarkdown({
			source,
			withKatex: true,
		});

		const plugins = useMemo<PluginConfig>(
			() => ({
				mermaid,
				code: {
					name: "shiki",
					type: "code-highlighter",
					getSupportedLanguages: () => CodeUtils.languages,
					supportsLanguage: () => true,
					getThemes: () => [codeTheme, codeTheme],
					highlight: ({ code, language }, callback) => {
						return CodeUtils.highlight(
							{ code, theme: codeTheme, language },
							callback,
						);
					},
				},
			}),
			[codeTheme],
		);

		return (
			<MarkdownContext value={context}>
				<Box
					maw={maw}
					style={{ overflowWrap: "break-word" }}
					className={
						context.style?.textSize
							? `**:${context.style?.textSize}`
							: undefined
					}
				>
					<Streamdown
						animated={ANIMATE_OPTIONS}
						isAnimating={context.streaming}
						mode={context.streaming ? "streaming" : "static"}
						components={COMPONENTS}
						remarkPlugins={remarkPlugins}
						rehypePlugins={rehypePlugins}
						plugins={plugins}
						shikiTheme={[codeTheme, codeTheme]}
						mermaid={{
							config: { theme: theme === "dark" ? "dark" : "neutral" },
						}}
						className="selectable"
					>
						{content}
					</Streamdown>
				</Box>
			</MarkdownContext>
		);
	},
	(previous, next) =>
		previous.source === next.source &&
		previous.context?.style === next.context?.style &&
		previous.context?.sources === next.context?.sources &&
		previous.context?.streaming === next.context?.streaming &&
		previous.maw === next.maw,
);
