import { useSession } from "@tiny-chat/client/src/core/hooks/useSession.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useCommands } from "@tiny-chat/client/src/features/editor/hooks/useCommands.ts";
import type {
	CommandEdit,
	CommandItem,
	CompletionGroup,
} from "@tiny-chat/client/src/features/editor/types/command.ts";
import { CommandUtils } from "@tiny-chat/client/src/features/editor/utils/CommandUtils.ts";
import clipboard from "clipboardy";
import { useCallback, useEffect, useMemo, useState } from "react";
import { client } from "../../../client.ts";
import { useAppStore } from "../../../core/stores/useAppStore.ts";

export const useCommand = ({
	content,
	setContent,
	cursor,
	setCursor,
}: {
	content: string;
	setContent: (content: string) => void;
	cursor: [row: number, column: number];
	setCursor: (cursor: [row: number, column: number]) => void;
}) => {
	const { session, requestClone } = useSession();

	const setPage = useAppStore((state) => state.setPage);
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	const isAnonymous =
		!session.data?.user || session.data.user.isAnonymous === true;

	const commands = useMemo<CommandItem[]>(
		() => [
			{
				name: "chat",
				value: "chat",
				run: () => setPage("chat-list"),
			},
			{
				name: "clear",
				value: "clear",
				run: () => ChatService.setChat({ id: null }),
			},
			{
				name: "quit",
				value: "quit",
				run: () => process.exit(0),
			},
			isAnonymous
				? {
						name: "login",
						value: "login",
						run: () =>
							requestClone.mutate(
								(id) => {
									clipboard.write(`${client.webUrl}#/?clone=${id}`);
									setStatus({
										id: "clone",
										text: "Waiting for you to sign in...",
									});
								},
								{ onSettled: () => unsetStatus({ id: "clone" }) },
							),
					}
				: {
						name: "logout",
						value: "logout",
						run: () => client.auth.signOut(),
					},
		],
		[isAnonymous, requestClone.mutate, setPage, setStatus, unsetStatus],
	);

	const { getCommands } = useCommands({
		commands,
		onOpenTools: () => setPage("tools"),
		onOpenSkills: () => setPage("skills"),
	});

	const all = getCommands();
	const query = CommandUtils.query({ content, cursor, groups: all });

	const commandGroups =
		!query || query.command
			? []
			: CommandUtils.filter({ groups: all, query: query.text });

	const choiceGroups = CommandUtils.filterChoices({
		command: query?.command ?? null,
		query: query?.text,
	});

	const groups: CompletionGroup[] = query?.command
		? choiceGroups
		: commandGroups;

	const count = groups.reduce((total, group) => total + group.items.length, 0);

	const [selected, setSelected] = useState(0);
	const index = Math.min(selected, Math.max(count - 1, 0));

	// biome-ignore lint/correctness/useExhaustiveDependencies: a new query starts at the top
	useEffect(() => {
		setSelected(0);
	}, [query?.text, query?.command?.value]);

	const move = useCallback(
		(offset: number) => {
			setSelected((previous) =>
				Math.min(Math.max(previous + offset, 0), Math.max(count - 1, 0)),
			);
		},
		[count],
	);

	const apply = useCallback(
		(edit: CommandEdit | null) => {
			if (!edit) return false;
			setContent(edit.content);
			setCursor(edit.cursor);
			return true;
		},
		[setContent, setCursor],
	);

	/**
	 * Take the highlighted completion, or the argument written for a command
	 * when there is nothing to highlight. Returns false when the input should
	 * be handled as regular text instead.
	 */
	const select = useCallback(
		({ complete }: { complete?: boolean } = {}) => {
			if (!query) return false;

			if (query.command) {
				const choice = choiceGroups.flatMap((group) => group.items)[index];
				if (choice) {
					return apply(
						CommandUtils.applyChoice({ content, query, choice, complete }),
					);
				}
				if (complete) return false;
				return apply(CommandUtils.applyContent({ content, query }));
			}

			const command = commandGroups.flatMap((group) => group.items)[index];
			if (!command) return false;
			return apply(
				CommandUtils.applyCommand({ content, query, command, complete }),
			);
		},
		[apply, choiceGroups, commandGroups, content, index, query],
	);

	return {
		groups,
		selected: index,
		/** whether the command being written owns the input's keys */
		isCommanding: count > 0 || !!query?.command,
		move,
		select,
	};
};
