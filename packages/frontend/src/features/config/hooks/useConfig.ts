import { useLocalStorage } from "@mantine/hooks";
import { useCallback, useMemo } from "react";
import { useMessages } from "#frontend/features/message/hooks/useMessages.ts";
import { zConfig } from "#shared/types/chat.ts";
import { useConfigStore } from "../stores/useConfigStore.ts";
import { useProviders } from "./useProviders.ts";

export const useConfig = () => {
	const overrideConfig = useConfigStore((s) => s.overrideConfig);
	const setOverrideConfig = useConfigStore((s) => s.setOverrideConfig);

	const [_lastConfig, _setLastConfig] = useLocalStorage<string>({
		key: "config",
		sync: true,
	});
	const lastConfig = useMemo(() => {
		try {
			if (typeof _lastConfig !== "string") {
				return zConfig.parse(_lastConfig);
			}
			return zConfig.parse(JSON.parse(_lastConfig));
		} catch {
			return null;
		}
	}, [_lastConfig]);

	const { messages } = useMessages();
	const lastMessageConfig = useMemo(() => {
		const messageList = messages.data?.pages.flatMap((p) => p.messages) ?? [];
		const lastMessage = messageList.reduce((acc, curr) => {
			return acc.createdAt.getTime() > curr.createdAt.getTime() ? acc : curr;
		}, messageList[0]);
		return lastMessage?.config ?? null;
	}, [messages]);

	const { providers } = useProviders();
	const fallbackConfig = useMemo(() => {
		const provider = providers.data?.chat.find((s) => s.models.length > 0);
		if (!provider) return null;
		return {
			provider: provider.name,
			model: provider.models[0].name,
		};
	}, [providers]);

	const config = useMemo(() => {
		return (
			overrideConfig ??
			lastMessageConfig ??
			lastConfig ??
			fallbackConfig ??
			({
				model: "",
				provider: "",
				toolGroups: [],
				skills: [],
			} satisfies zConfig)
		);
	}, [overrideConfig, lastMessageConfig, lastConfig, fallbackConfig]);

	const setConfig = useCallback(
		(value: zConfig) => {
			console.log("setConfig:", value);
			setOverrideConfig(value);
			_setLastConfig(JSON.stringify(value));
		},
		[setOverrideConfig, _setLastConfig],
	);

	return { config, setConfig };
};
