import { useAutoExpand } from "@tiny-chat/client/features/part/hooks/useAutoExpand.ts";
import type { RenderedPart } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import Markdown from "../../message/components/Markdown.tsx";
import ScrollTail from "./ScrollTail.tsx";
import Task from "./Task.tsx";

const DETAILS_PROPS = { paddingY: 1, backgroundColor: "surface" } as const;

/**
 * A run of thinking: open while it streams in, folded back to one line once
 * something follows it.
 */
export default function Thought({
	thoughts,
	hold,
}: {
	thoughts: Extract<RenderedPart, { type: "thought" }>[];
	/** Keeps it open after it settles, until something follows it. */
	hold?: boolean;
}) {
	const pending = thoughts.some((thought) => thought.active);

	const thoughtText = thoughts.map((thought) => thought.value).join("\n\n");

	const { expanded, auto, toggle } = useAutoExpand(pending || !!hold);

	return (
		<Task.Group detailsProps={DETAILS_PROPS}>
			<Task expanded={expanded} onToggle={toggle}>
				<Task.Status
					status={pending ? "pending" : "success"}
					emoji="🧠"
					parts={[{ text: pending ? "Thinking" : "Thought" }]}
				/>
				<Task.Details>
					<ScrollTail follow={auto}>
						<Markdown source={thoughtText} streaming={pending} />
					</ScrollTail>
				</Task.Details>
			</Task>
		</Task.Group>
	);
}
