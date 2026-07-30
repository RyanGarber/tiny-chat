import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useStatusStore } from "../../../core/stores/useStatusStore.ts";
import type { CompletionItem } from "../components/Completions.tsx";

export interface Command extends CompletionItem {
	execute: () => void;
}

const COMMAND_REGEX = /(?:^|\s)\/(\S*)$/;

const getQuery = (content: string, cursor?: [number, number]) => {
	if (!cursor) return undefined;

	const [row, column] = cursor;

	// TODO - capture part of command after cursor
	const line = content.split("\n")[row] ?? "";
	const text = COMMAND_REGEX.exec(line.slice(0, column))?.[1];

	if (text === undefined) return undefined;

	return { text, start: column - (text?.length ?? 0), end: column };
};

export const useCommands = ({
	content,
	setContent,
	cursor,
}: {
	content: string;
	setContent: (content: string) => void;
	cursor?: [number, number];
}) => {
	const [commands, setCommands] = useState<Command[]>([]);

	const { cloneSession } = useSession();

	const getCommands = useCallback(async (): Promise<Command[]> => {
		return [
			{
				name: "auth",
				value: "auth",
				execute: () => {
					cloneSession.mutate();
				},
			},
			{
				name: "chats",
				value: "chats",
				execute: () => {
					useStatusStore.getState().setStatus({ id: "test" });
					setTimeout(
						() => useStatusStore.getState().unsetStatus({ id: "test" }),
						2000,
					);
				},
			},
		];
	}, [cloneSession.mutate]);

	useEffect(() => {
		const query = getQuery(content, cursor);

		if (!query) {
			setCommands([]);
			return;
		}

		getCommands().then((commands) => {
			setCommands(
				commands.filter((command) =>
					command.name.includes(query.text.toLowerCase()),
				),
			);
		});
	}, [cursor, content, getCommands]);

	const executeCommand = useCallback(
		(item: Command) => {
			const query = getQuery(content, cursor);
			setContent(
				content.slice(0, (query?.start ?? 1) - 1) +
					content.slice(query?.end ?? 0),
			);
			item.execute();
		},
		[content.slice, setContent, cursor, content],
	);

	return { commands, executeCommand };
};
