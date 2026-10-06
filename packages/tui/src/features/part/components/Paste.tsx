import type { ReactNode } from "react";
import Task from "#tui/features/part/components/Task.tsx";

export default function Paste({
	lines,
	children,
}: {
	lines?: string;
	children: ReactNode;
}) {
	return (
		<Task>
			<Task.Status
				status="success"
				emoji="📋"
				parts={[{ text: lines ? `${lines} pasted lines` : "Pasted" }]}
			/>
			<Task.Details>{children}</Task.Details>
		</Task>
	);
}
