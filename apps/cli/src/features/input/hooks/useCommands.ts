import { useSession } from "@tiny-chat/client/src/core/hooks/useSession.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import clipboard from "clipboardy";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../../../client.ts";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
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
	const { session, requestClone } = useSession();

	const sessionRef = useRef(session.data);
	sessionRef.current = session.data;

	const setPage = useAppStore((state) => state.setPage);
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	const [commands, setCommands] = useState<Command[]>([]);

	const getCommands = useCallback(async (): Promise<Command[]> => {
		const commands: Command[] = [
			{
				name: "chat",
				value: "chat",
				execute: () => {
					setPage("chat-list");
				},
			},
			{
				name: "clear",
				value: "clear",
				execute: () => {
					ChatService.setChat({ id: null });
				},
			},
			{
				name: "model",
				value: "model",
				execute: () => {
					setPage("model-list");
				},
			},
			{
				name: "quit",
				value: "quit",
				execute: () => {
					process.exit(0);
				},
			},
		];

		if (sessionRef.current?.user && !sessionRef.current.user.isAnonymous) {
			commands.push({
				name: "logout",
				value: "logout",
				execute: () => {
					client.auth.signOut();
				},
			});
		} else {
			commands.push({
				name: "login",
				value: "login",
				execute: () => {
					requestClone.mutate(
						(id) => {
							clipboard.write(`${client.webUrl}#/?clone=${id}`);
							setStatus({ id: "clone", text: "Waiting for you to sign in..." });
						},
						{
							onSettled: () => {
								unsetStatus({ id: "clone" });
							},
						},
					);
				},
			});
		}

		return commands;
	}, [requestClone.mutate, setPage, setStatus, unsetStatus]);

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
