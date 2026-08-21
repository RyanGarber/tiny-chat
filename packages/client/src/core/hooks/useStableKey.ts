import type { Capabilities } from "@tiny-chat/core/src/core/types/capability.ts";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import type {
	MessageState,
	zData,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zMCPServers } from "@tiny-chat/core/src/features/data/types/user.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import { useMemo } from "react";
import type { McpServer } from "../../features/agent/hooks/useMcp.ts";

export function getPartsKey(parts?: zDataPart[]) {
	if (!parts?.length) return "";
	const first = parts[0];
	const last = parts[parts.length - 1];
	return `${getPartKey(first)}:${parts.length}:${getPartKey(last)}`;
}

export function getPartKey(part?: zDataPart) {
	if (!part) return "";
	let keys = "";
	let value = "";
	if (part.type === "text" || part.type === "thought") {
		value = part.value;
	} else if (part.type === "json") {
		value = JSON.stringify(part.value);
	} else if (part.type === "file") {
		keys = `${part.name}:${part.mime}`;
		value = part.data;
	} else if (part.type === "toolCall") {
		keys = `${part.id}:${part.name}`;
		value = `${part.id}:${part.name}:${JSON.stringify(part.args)}`;
	} else if (part.type === "toolResult") {
		keys = `${part.id}:${part.name}:${part.error}:${getPartsKey(part.value)}`;
	} else if (part.type === "abort") {
		keys = `${part.reason}:${part.message}`;
		value = JSON.stringify(part.details);
	}
	return `${part.type}:${keys}:${value.at(0)}:${value.length}:${value.at(-1)}`;
}

export const useStableKey = ({
	data,
	messages,
	providers,
	capabilities,
	mcpServers,
	mcpServerSettings,
}: {
	data?: zData;
	messages?: (MessageState | zAgentMessage)[];
	providers?: ProviderState<ProviderStatus>[];
	capabilities?: Capabilities;
	mcpServers?: McpServer[];
	mcpServerSettings?: zMCPServers;
}) => {
	const dataKey = useMemo(() => {
		const parts = data?.flat();
		return getPartsKey(parts);
	}, [data]);

	const messagesKey = useMemo(() => {
		let key = "";
		for (const message of messages ?? []) {
			const parts = message.data.flat();
			key += `${message.id}:${message.author}${message.config?.model}:${getPartsKey(parts)};`;
		}
		return key;
	}, [messages]);

	const providersKey = useMemo(() => {
		let key = "";
		for (const provider of providers ?? []) {
			key += `${provider.name}:${provider.status.valid}:${provider.status.error};`;
		}
		return key;
	}, [providers]);

	const capabilitiesKey = useMemo(() => {
		let key = "";
		for (const [name, value] of Object.entries(capabilities ?? {})) {
			key += `${name}:${JSON.stringify(value)};`;
		}
		return key;
	}, [capabilities]);

	const mcpServersKey = useMemo(() => {
		let key = "";
		for (const server of mcpServers ?? []) {
			key += `${server.name}:${server.tools.length}:${server.error};`;
		}
		return key;
	}, [mcpServers]);

	const mcpServerSettingsKey = useMemo(() => {
		let key = "";
		for (const [name, value] of Object.entries(mcpServerSettings ?? {})) {
			let settings = "";
			if ("url" in value)
				settings = `${value.url}:${value.headers ? JSON.stringify(value.headers) : ""}`;
			else if ("command" in value)
				settings = `${value.command}:${value.args}:${value.env ? JSON.stringify(value.env) : ""}`;
			key += `${name}:${settings};`;
		}
		return key;
	}, [mcpServerSettings]);

	return useMemo(() => {
		return `${dataKey}:${messagesKey}:${providersKey}:${capabilitiesKey}:${mcpServersKey}:${mcpServerSettingsKey}`;
	}, [
		dataKey,
		messagesKey,
		providersKey,
		capabilitiesKey,
		mcpServersKey,
		mcpServerSettingsKey,
	]);
};
