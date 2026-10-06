import chalk from "chalk";
import { useState } from "react";
import type { McpToolset } from "#client/features/agent/hooks/useTools.ts";
import type { CompletionGroup } from "#client/features/editor/types/completion.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { zMCPServers } from "#core/features/data/types/user.ts";
import Box from "#tui/core/components/Box.tsx";
import Text from "#tui/core/components/Text.tsx";
import { usePage } from "#tui/core/hooks/usePage.ts";
import Completions from "#tui/features/editor/components/Completions.tsx";
import Choice from "#tui/features/settings/components/Choice.tsx";
import TextList, {
	type Draft,
	type TextEntry,
} from "#tui/features/settings/components/TextList.tsx";

export type McpServer = NonNullable<zMCPServers>[string];

interface RootItem {
	name: string;
	value: string;
	state?: string;
	route: string;
}

/** Server names are the keys of the settings, which only take these. */
const toName = (text: string) =>
	text
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-_]+/g, "-");

const toEntries = (record: Record<string, string> = {}): TextEntry[] =>
	Object.entries(record).map(([label, text]) => ({ label, text }));

/** `NAME=value`, split at the first `=`. */
const parseEntry = (text: string) => {
	const at = text.indexOf("=");
	const key = (at < 0 ? text : text.slice(0, at)).trim();
	return key ? { key, value: at < 0 ? "" : text.slice(at + 1).trim() } : null;
};

/**
 * One MCP server's connection — its name, transport and what it runs with —
 * like a server's card in the app's tools and skills.
 */
export default function McpServerEditor({
	name,
	server,
	toolset,
	isConnecting,
	onSave,
	onDelete,
	onRefresh,
	onClose,
}: {
	name: string;
	server: McpServer;
	toolset?: McpToolset;
	isConnecting: boolean;
	/** Saves the server, under a new name when it was renamed. */
	onSave: (nextName: string, server: McpServer) => void;
	onDelete: () => void;
	onRefresh: () => void;
	onClose: () => void;
}) {
	const [path, setPath] = useState<string[]>([]);
	const route = path.at(-1) ?? null;
	const push = (next: string) => setPath((current) => [...current, next]);
	const pop = () => setPath((current) => current.slice(0, -1));

	const [draft, setDraft] = useState<Draft | null>(null);
	const [selected, setSelected] = useState(0);

	usePage({
		onBack: () => {
			if (draft) setDraft(null);
			else if (path.length) pop();
			else onClose();
			return false;
		},
	});

	const save = (next: McpServer) => onSave(name, next);

	/** A record of the server's — env or headers — edited as `NAME=value`. */
	const recordList = (
		record: Record<string, string> | undefined,
		set: (record: Record<string, string>) => void,
	) => {
		const entries = Object.entries(record ?? {});
		return (
			<TextList
				entries={toEntries(record)}
				draft={draft}
				setDraft={setDraft}
				placeholder="NAME=value"
				mask
				onAdd={(text) => {
					const entry = parseEntry(text);
					if (entry) set({ ...record, [entry.key]: entry.value });
				}}
				onEdit={(index, value) =>
					set({ ...record, [entries[index][0]]: value })
				}
				onRemove={(index) =>
					set(Object.fromEntries(entries.filter((_, other) => other !== index)))
				}
			/>
		);
	};

	/** A single text of the server's, written in place. */
	const textField = (
		label: string,
		text: string,
		placeholder: string,
		set: (text: string) => void,
	) => (
		<TextList
			entries={[{ label, text }]}
			draft={draft}
			setDraft={setDraft}
			placeholder={placeholder}
			onEdit={(_, text) => set(text)}
		/>
	);

	if (route === "name") {
		return textField("name", name, "server", (text) => {
			const nextName = toName(text);
			if (nextName && nextName !== name) onSave(nextName, server);
		});
	}
	if (route === "transport") {
		const current = "command" in server ? "stdio" : "http";
		return (
			<Choice
				groups={[
					{
						items: ["stdio", "http"].map((value) => ({
							name: value,
							value,
							active: value === current,
						})),
					},
				]}
				onSelect={(item) => {
					if (item.value !== current) {
						save(item.value === "stdio" ? { command: "" } : { url: "" });
					}
					pop();
				}}
			/>
		);
	}
	if (route === "command" && "command" in server) {
		return textField("command", server.command, "npx", (command) =>
			save({ ...server, command }),
		);
	}
	if (route === "args" && "command" in server) {
		const args = server.args ?? [];
		return (
			<TextList
				entries={args.map((text) => ({ text }))}
				draft={draft}
				setDraft={setDraft}
				placeholder="argument"
				onAdd={(arg) => save({ ...server, args: [...args, arg] })}
				onEdit={(index, arg) =>
					save({ ...server, args: args.with(index, arg) })
				}
				onRemove={(index) =>
					save({
						...server,
						args: args.filter((_, other) => other !== index),
					})
				}
			/>
		);
	}
	if (route === "env" && "command" in server) {
		return recordList(server.env, (env) => save({ ...server, env }));
	}
	if (route === "url" && "url" in server) {
		return textField("url", server.url, "https://example.com/mcp", (url) =>
			save({ ...server, url }),
		);
	}
	if (route === "headers" && "url" in server) {
		return recordList(server.headers, (headers) =>
			save({ ...server, headers }),
		);
	}
	if (route === "delete") {
		return (
			<Choice
				groups={[
					{
						items: [
							{ name: "cancel", value: "cancel" },
							{ name: "confirm", value: "confirm" },
						],
					},
				]}
				before={<Text color="textSubtle">{`${name} will be removed.`}</Text>}
				onSelect={(item) => {
					if (item.value !== "confirm") return pop();
					onDelete();
					onClose();
				}}
			/>
		);
	}

	const count = (record?: Record<string, string>) =>
		String(Object.keys(record ?? {}).length);

	const groups: CompletionGroup<RootItem>[] = [
		{
			name: "server",
			items: [
				{ name: "name", value: "name", state: name, route: "name" },
				{
					name: "transport",
					value: "transport",
					state: "command" in server ? "stdio" : "http",
					route: "transport",
				},
			],
		},
		{
			name: "connection",
			items:
				"command" in server
					? [
							{
								name: "command",
								value: "command",
								state: server.command || undefined,
								route: "command",
							},
							{
								name: "arguments",
								value: "arguments",
								state: String(server.args?.length ?? 0),
								route: "args",
							},
							{
								name: "environment",
								value: "environment",
								state: count(server.env),
								route: "env",
							},
						]
					: [
							{
								name: "url",
								value: "url",
								state: server.url || undefined,
								route: "url",
							},
							{
								name: "headers",
								value: "headers",
								state: count(server.headers),
								route: "headers",
							},
						],
		},
		{
			items: [{ name: "remove", value: "remove", route: "delete" }],
		},
	];

	const error = toolset?.status.error;

	return (
		<Completions<CompletionGroup<RootItem>, RootItem>
			groups={groups}
			selected={selected}
			setSelected={setSelected}
			selectFirstOnChange={false}
			before={
				<Text color={!isConnecting && error ? "redBright" : "textSubtle"}>
					{isConnecting || !toolset
						? "connecting..."
						: error
							? CommonUtils.formatError(toolset.status)
							: toolset.tools.map((tool) => tool.name).join(", ") || "no tools"}
				</Text>
			}
			itemProps={{
				flexGrow: 1,
				flexShrink: 1,
				maxWidth: 50,
				justifyContent: "space-between",
			}}
			onInput={({ item, input, key }) => {
				if (item && key.return) {
					push(item.route);
					return true;
				}
				if (input === "r") {
					onRefresh();
					return true;
				}
			}}
			renderItem={({ item }) => (
				<>
					<Box flexShrink={0} marginRight={2}>
						<Text color={item.route === "delete" ? "redBright" : undefined}>
							{item.name}
						</Text>
					</Box>
					{item.route !== "delete" && (
						<Text color="text" wrap="truncate-start">
							{item.state ?? chalk.dim("(none)")}
						</Text>
					)}
				</>
			)}
			actions={[
				{ key: "enter", name: "open" },
				{ key: "r", name: "reconnect" },
				"back",
			]}
		/>
	);
}
