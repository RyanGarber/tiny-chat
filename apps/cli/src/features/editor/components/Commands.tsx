import { useSession } from "@tiny-chat/client/src/core/hooks/useSession.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useCommands } from "@tiny-chat/client/src/features/editor/hooks/useCommands.ts";
import type {
	CommandChoiceGroup,
	CommandChoiceItem,
	CommandEdit,
	CommandGroup,
	CommandItem,
} from "@tiny-chat/client/src/features/editor/types/command.ts";
import type { CompletionGroup } from "@tiny-chat/client/src/features/editor/types/completion.ts";
import { CommandUtils } from "@tiny-chat/client/src/features/editor/utils/CommandUtils.ts";
import { useCallback, useMemo } from "react";
import { client } from "../../../client.ts";
import { ClipboardService } from "../../../core/services/ClipboardService.ts";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import { useUpdate } from "../../update/hooks/useUpdate.ts";
import Completions from "./Completions.tsx";

export default function Commands({
	content,
	setContent,
	cursor,
	setCursor,
}: {
	content: string;
	setContent: (content: string) => void;
	cursor: [row: number, column: number];
	setCursor: (cursor: [row: number, column: number]) => void;
}) {
	const { session, requestClone } = useSession();
	const { update, doUpdate } = useUpdate();

	const setPage = useAppStore((state) => state.setPage);
	const setStatus = useAppStore((state) => state.setStatus);
	const unsetStatus = useAppStore((state) => state.unsetStatus);

	const isAnonymous =
		!session.data?.user || session.data.user.isAnonymous === true;

	// Offered only once there is a release to take, which is also the only time
	// the status announcing it points here.
	const version = update.data;

	const cliCommands = useMemo<CommandItem[]>(
		() => [
			{
				name: "chats",
				value: "chats",
				run: () => setPage("chats"),
			},
			{
				name: "clear",
				value: "clear",
				run: () => ChatService.setChat({ id: null }),
			},
			{
				name: "settings",
				value: "settings",
				run: () => setPage("settings"),
			},
			{
				name: "quit",
				value: "quit",
				run: () => process.exit(0),
			},
			...(version
				? [
						{
							name: "update",
							value: "update",
							run: () => doUpdate.mutate(version),
						},
					]
				: []),
			isAnonymous
				? {
						name: "login",
						value: "login",
						run: async () =>
							requestClone.mutate(
								(id) => {
									ClipboardService.copy(`${client.webUrl}#/?clone=${id}`);
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
		[
			isAnonymous,
			requestClone.mutate,
			doUpdate.mutate,
			version,
			setPage,
			setStatus,
			unsetStatus,
		],
	);

	const { getCommands } = useCommands({
		commands: cliCommands,
		onOpenTools: () => setPage("tools"),
		onOpenSkills: () => setPage("skills"),
		onOpenUploads: () => setPage("uploads"),
		onOpenGitHub: () => setPage("github"),
	});

	const commands = getCommands();
	const query = CommandUtils.query({ content, cursor, groups: commands });

	const commandGroups =
		!query || query.command
			? []
			: CommandUtils.filter({ groups: commands, query: query.text });

	const choiceGroups = CommandUtils.filterChoices({
		command: query?.command ?? null,
		query: query?.text,
	});

	const groups: CompletionGroup[] = query?.command
		? choiceGroups
		: commandGroups;

	const apply = useCallback(
		(edit: CommandEdit | null) => {
			if (!edit) return false;
			setContent(edit.content);
			setCursor(edit.cursor);
			return true;
		},
		[setContent, setCursor],
	);

	if (!query) return null;

	if (query.command) {
		return (
			<Completions<CommandChoiceGroup, CommandChoiceItem>
				groups={groups}
				renderEmpty={() => {
					return "no matches";
				}}
				onInput={({ item, key }) => {
					if (key.return && !item) {
						apply(CommandUtils.applyContent({ content, query }));
					}
					if (key.return && item) {
						apply(
							CommandUtils.applyChoice({
								content,
								query,
								choice: item,
								complete: false,
							}),
						);
					}
					if (key.tab && item) {
						apply(
							CommandUtils.applyChoice({
								content,
								query,
								choice: item,
								complete: true,
							}),
						);
					}
				}}
			/>
		);
	} else {
		return (
			<Completions<CommandGroup, CommandItem>
				groups={groups}
				renderItem={({ item }) => {
					return `/${item.name ?? item.value}`;
				}}
				renderEmpty={() => {
					return "no matches";
				}}
				onInput={({ key, item }) => {
					if (key.return && item) {
						apply(
							CommandUtils.applyCommand({
								content,
								query,
								command: item,
								complete: false,
							}),
						);
					}
					if (key.tab && item) {
						apply(
							CommandUtils.applyCommand({
								content,
								query,
								command: item,
								complete: true,
							}),
						);
					}
				}}
				actions={[{ key: "tab", name: "fill" }]}
			/>
		);
	}
}
