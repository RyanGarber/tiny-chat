import { useInstructions } from "#client/features/settings/hooks/useInstructions.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import { useWorkingStatus } from "#tui/core/hooks/useWorkingStatus.ts";
import TextList, {
	type Draft,
} from "#tui/features/settings/components/TextList.tsx";

/** The instructions of the user, or of one project when given. */
export default function InstructionSettings({
	project,
	draft,
	setDraft,
}: {
	project: ProjectLike | null;
	draft: Draft | null;
	setDraft: (draft: Draft | null) => void;
}) {
	const { instructions, addInstruction, updateInstruction, removeInstruction } =
		useInstructions({ project });
	useWorkingStatus(addInstruction, updateInstruction, removeInstruction);

	return (
		<TextList
			entries={(instructions ?? []).map((text) => ({ text }))}
			draft={draft}
			setDraft={setDraft}
			placeholder="Keep responses short."
			onAdd={(instruction) => addInstruction.mutate({ project, instruction })}
			onEdit={(index, instruction) =>
				updateInstruction.mutate({ project, index, instruction })
			}
			onRemove={(index) => removeInstruction.mutate({ project, index })}
		/>
	);
}
