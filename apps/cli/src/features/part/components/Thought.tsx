import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import Markdown from "../../message/components/Markdown.tsx";
import Task from "./Task.tsx";

export default function Thought({
	thoughts,
}: {
	thoughts: Extract<RenderedPart, { type: "thought" }>[];
}) {
	const pending = thoughts.some((thought) => thought.active);

	const thoughtText = thoughts.map((thought) => thought.value).join("\n\n");

	return (
		<Task>
			<Task.Status
				status={pending ? "pending" : "success"}
				emoji="🧠"
				parts={[{ text: pending ? "Thinking" : "Thought" }]}
			/>
			<Task.Details>
				<Markdown source={thoughtText} streaming={pending} />
			</Task.Details>
		</Task>
	);
}
