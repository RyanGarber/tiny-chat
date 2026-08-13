import type { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ColorName } from "chalk";
import { useMemo } from "react";
import Markdown from "../../message/components/Markdown.tsx";
import Task from "./Task.tsx";

export default function Thought({
	thoughts,
	context,
}: {
	thoughts: Extract<RenderedPart, { type: "thought" }>[];
	context?: MarkdownContext<never, ColorName>;
}) {
	const pending = thoughts.some((thought) => thought.active);

	const thoughtText = useMemo(
		() => thoughts.map((thought) => thought.value).join("\n\n"),
		[thoughts],
	);

	return (
		<Task>
			<Task.Status
				status={pending ? "pending" : "success"}
				emoji="🧠"
				parts={[{ text: pending ? "Thinking" : "Thought" }]}
			/>
			<Task.Details>
				<Markdown source={thoughtText} context={{ ...context }} />
			</Task.Details>
		</Task>
	);
}
