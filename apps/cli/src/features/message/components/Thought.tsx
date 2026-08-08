import type { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import chalk, { type ColorName } from "chalk";
import cliSpinners from "cli-spinners";
import { Task } from "ink-task-list";
import { useMemo } from "react";
import Markdown from "./Markdown.tsx";

export default function Thought({
	thoughts,
	context,
	textColor,
	isExpanded,
}: {
	thoughts: Extract<RenderedPart, { type: "thought" }>[];
	context?: MarkdownContext<never, ColorName>;
	textColor?: ColorName;
	isExpanded?: boolean;
}) {
	const pending = thoughts.some((thought) => thought.active);

	const thoughtText = useMemo(
		() => thoughts.map((thought) => thought.value).join("\n\n"),
		[thoughts],
	);

	return (
		<Task
			label={chalk.blueBright(pending ? "Thinking" : "Thought")}
			state={pending ? "loading" : "success"}
			spinner={cliSpinners.dots}
			isExpanded={isExpanded}
		>
			<Markdown
				source={thoughtText}
				context={{ ...context, style: { textColor } }}
			/>
		</Task>
	);
}
