import { useLocalStorage } from "@mantine/hooks";
import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { ModelProviderStatus } from "@tiny-chat/core/src/features/provider/types/model.ts";
import type { ProviderState } from "@tiny-chat/core/src/features/provider/types/provider.ts";
import { useMessages } from "@tiny-chat/react/src/features/chat/hooks/useMessages.ts";
import { useCallback, useMemo } from "react";
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
		const provider = providers.data
			?.filter(
				(provider): provider is ProviderState<ModelProviderStatus> =>
					provider.type === "model",
			)
			.find((s) => s.status.models.length > 0);
		if (!provider) return null;
		return {
			provider: provider.name,
			model: provider.status.models[0].name,
			args: {},
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
				args: {},
				toolsets: [],
				skills: [],
			} satisfies zConfig)
		);
	}, [overrideConfig, lastMessageConfig, lastConfig, fallbackConfig]);

	const setConfig = useCallback(
		(value: zConfig) => {
			console.log("[useConfig] set config:", value);
			setOverrideConfig(value);
			_setLastConfig(JSON.stringify(value));
		},
		[setOverrideConfig, _setLastConfig],
	);

	const modelArgs = useMemo(() => {
		return (
			providers.data
				?.filter(
					(provider): provider is ProviderState<ModelProviderStatus> =>
						provider.type === "model",
				)
				.find((s) => s.name === config.provider)
				?.status.models.find((m) => m.name === config.model)?.args ?? []
		);
	}, [config.provider, config.model, providers.data]);

	const setModelArg = useCallback(
		(name: string, value: unknown) => {
			if (!config) return;
			const newConfig = {
				...config,
				args: { ...config.args, [name]: value },
			};
			setConfig(newConfig);
		},
		[config, setConfig],
	);

	return { config, setConfig, modelArgs, setModelArg };
};
