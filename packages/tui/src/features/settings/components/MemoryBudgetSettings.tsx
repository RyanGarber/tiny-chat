import { useInstructions } from "#client/features/settings/hooks/useInstructions.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import { useWorkingStatus } from "#tui/core/hooks/useWorkingStatus.ts";
import Choice from "#tui/features/settings/components/Choice.tsx";

/** The budgets the memory can be filled up to, as the app's slider steps. */
const MEMORY_BUDGETS = Array.from({ length: 21 }, (_, i) => i * 500);

/** The memory budget of the user, or of one project when given. */
export default function MemoryBudgetSettings({
	project,
	onDone,
}: {
	project: ProjectLike | null;
	onDone: () => void;
}) {
	const { memoryBudget, setMemoryBudget } = useInstructions({ project });
	useWorkingStatus(setMemoryBudget);

	return (
		<Choice
			groups={[
				{
					items: MEMORY_BUDGETS.map((tokens) => ({
						name: String(tokens),
						value: String(tokens),
						active: tokens === memoryBudget,
					})),
				},
			]}
			onSelect={(item) => {
				setMemoryBudget.mutate({ project, tokens: Number(item.value) });
				onDone();
			}}
		/>
	);
}
