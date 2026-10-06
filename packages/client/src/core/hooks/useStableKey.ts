import { useMemo } from "react";
import type { McpServer } from "#client/features/agent/hooks/useMcp.ts";
import type { Capabilities } from "#core/core/types/capability.ts";
import type {
	zAgentChat,
	zAgentMessage,
} from "#core/features/agent/types/agent.ts";
import type {
	MessageState,
	zConfig,
} from "#core/features/data/types/message.ts";
import type { zData, zDataPart } from "#core/features/data/types/part.ts";
import type { zMCPServers, zSettings } from "#core/features/data/types/user.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "#core/features/provider/types/provider.ts";
import type { zSkill } from "#core/features/skill/types/skill.ts";
import type { Toolset } from "#core/features/tool/types/tool.ts";
import { ToolUtils } from "#core/features/tool/utils/ToolUtils.ts";

/** A compact, order-stable fingerprint for large query inputs. */
export function getValueKey(value: unknown): string {
	let first = 0x811c9dc5;
	let second = 0x9e3779b9;
	let length = 0;
	let nextReference = 0;
	const seen = new WeakMap<object, number>();

	const write = (text: string) => {
		length += text.length;
		for (let i = 0; i < text.length; i++) {
			const code = text.charCodeAt(i);
			first = Math.imul(first ^ code, 0x01000193) >>> 0;
			second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
		}
	};

	const visit = (item: unknown) => {
		if (item === null) return write("null;");
		if (item === undefined) return write("undefined;");
		if (typeof item === "string")
			return write(`string:${item.length}:${item};`);
		if (typeof item === "number" || typeof item === "boolean")
			return write(`${typeof item}:${String(item)};`);
		if (typeof item === "bigint") return write(`bigint:${item.toString()};`);
		if (typeof item === "function") return write(`function:${item.name};`);
		if (typeof item !== "object")
			return write(`${typeof item}:${String(item)};`);

		const existing = seen.get(item);
		if (existing !== undefined) return write(`reference:${existing};`);
		seen.set(item, nextReference++);

		if (Array.isArray(item)) {
			write(`array:${item.length}[`);
			for (const value of item) visit(value);
			return write("];");
		}
		if (item instanceof Map) {
			write(`map:${item.size}{`);
			for (const [key, value] of [...item.entries()].sort(([a], [b]) =>
				String(a).localeCompare(String(b)),
			)) {
				visit(key);
				visit(value);
			}
			return write("};");
		}
		if (item instanceof Set) {
			write(`set:${item.size}[`);
			for (const value of [...item].sort((a, b) =>
				String(a).localeCompare(String(b)),
			))
				visit(value);
			return write("];");
		}

		const json = (item as { toJSON?: () => unknown }).toJSON;
		if (typeof json === "function") {
			write("json:");
			visit(json.call(item));
			return;
		}

		const record = item as Record<string, unknown>;
		const keys = Object.keys(record).sort();
		write(`object:${keys.length}{`);
		for (const key of keys) {
			write(`${key.length}:${key}=`);
			visit(record[key]);
		}
		write("};");
	};

	visit(value);
	return `${length.toString(36)}:${first.toString(36)}:${second.toString(36)}`;
}

export function getPartsKey(parts?: zDataPart[]) {
	return parts?.length ? getValueKey(parts) : "";
}

export function getToolsetsKey(toolsets?: Toolset<any>[]) {
	return getValueKey(
		toolsets?.map((toolset) => ({
			name: ToolUtils.name({ toolset }),
			instructions: toolset.instructions,
			status: toolset.status,
			tools: toolset.tools.map((tool) =>
				ToolUtils.getPromptDefinition({
					...tool,
					name: ToolUtils.name({ toolset, tool }),
				}),
			),
		})) ?? [],
	);
}

export const useStableKey = ({
	data,
	messages,
	providers,
	capabilities,
	mcpServers,
	mcpServerSettings,
	toolsets,
	skills,
	config,
	settings,
	chat,
}: {
	data?: zData;
	messages?: (MessageState | zAgentMessage)[];
	providers?: ProviderState<ProviderStatus>[];
	capabilities?: Capabilities;
	mcpServers?: McpServer[];
	mcpServerSettings?: zMCPServers;
	toolsets?: Toolset<any>[];
	skills?: zSkill[];
	config?: zConfig | null;
	settings?: zSettings | null;
	chat?: zAgentChat | null;
}) => {
	const dataKey = useMemo(() => {
		const parts = data?.flat();
		return getPartsKey(parts);
	}, [data]);

	const messagesKey = useMemo(() => {
		return getValueKey(messages ?? []);
	}, [messages]);

	const providersKey = useMemo(() => {
		return getValueKey(providers ?? []);
	}, [providers]);

	const capabilitiesKey = useMemo(() => {
		return getValueKey(capabilities ?? {});
	}, [capabilities]);

	const mcpServersKey = useMemo(() => {
		return getValueKey(
			mcpServers?.map(({ name, id, tools, error }) => ({
				name,
				id,
				tools,
				error,
			})) ?? [],
		);
	}, [mcpServers]);

	const mcpServerSettingsKey = useMemo(() => {
		return getValueKey(mcpServerSettings ?? {});
	}, [mcpServerSettings]);

	const toolsetsKey = useMemo(() => {
		return getToolsetsKey(toolsets);
	}, [toolsets]);

	const skillsKey = useMemo(() => getValueKey(skills ?? []), [skills]);

	const configKey = useMemo(() => {
		return config ? getValueKey(config) : "";
	}, [config]);

	const settingsKey = useMemo(() => {
		return settings ? getValueKey(settings) : "";
	}, [settings]);

	const chatKey = useMemo(() => {
		return chat ? getValueKey(chat) : "";
	}, [chat]);

	return useMemo(() => {
		return [
			dataKey,
			messagesKey,
			providersKey,
			capabilitiesKey,
			mcpServersKey,
			mcpServerSettingsKey,
			toolsetsKey,
			skillsKey,
			configKey,
			settingsKey,
			chatKey,
		]
			.filter(Boolean)
			.join(";");
	}, [
		dataKey,
		messagesKey,
		providersKey,
		capabilitiesKey,
		mcpServersKey,
		mcpServerSettingsKey,
		toolsetsKey,
		skillsKey,
		configKey,
		settingsKey,
		chatKey,
	]);
};
