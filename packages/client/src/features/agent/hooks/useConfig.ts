import { zConfig } from "@tiny-chat/core/features/data/types/message.ts";
import type { ModelProviderStatus } from "@tiny-chat/core/features/provider/types/model.ts";
import type { ProviderState } from "@tiny-chat/core/features/provider/types/provider.ts";
import { useCallback, useContext, useEffect, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useChatStore } from "../../chat/stores/useChatStore.ts";
import { useMessages } from "../../message/hooks/useMessages.ts";
import { useConfigStore } from "../stores/useConfigStore.ts";
import { useConfigEditor } from "./useConfigEditor.ts";
import { useProviders } from "./useProviders.ts";

export const useConfig = () => {
	const client = useContext(ClientContext);

	const chatId = useChatStore((s) => s.chatId);
	const overrideConfig = useConfigStore((s) => s.overrideConfig);
	const setOverrideConfig = useConfigStore((s) => s.setOverrideConfig);
	const syncChatId = useConfigStore((s) => s.syncChatId);
	const setSyncChatId = useConfigStore((s) => s.setSyncChatId);

	const lastConfig = useMemo(() => {
		try {
			const lastConfig = client.getStorage("config");
			return zConfig.parse(lastConfig);
		} catch {
			return null;
		}
	}, [client.getStorage]);

	// Last sent of the visible messages, whatever their order in the branch.
	const { messages } = useMessages();
	const lastMessageConfig = useMemo(() => {
		const messageList = messages.data?.pages.flatMap((p) => p.messages) ?? [];
		const lastMessage = messageList.reduce((current, candidate) => {
			return Temporal.PlainDateTime.compare(
				candidate.createdAt,
				current.createdAt,
			) > 0
				? candidate
				: current;
		}, messageList[0]);
		return lastMessage?.config ?? null;
	}, [messages]);

	// Entering an existing chat adopts its last config once its messages load.
	const syncing = !!syncChatId && syncChatId === chatId;
	const synced = syncing && messages.isSuccess && !messages.isPlaceholderData;
	useEffect(() => {
		if (!synced) return;
		if (lastMessageConfig) {
			setOverrideConfig(lastMessageConfig);
			client.setStorage("config", lastMessageConfig);
		} else {
			setSyncChatId(null);
		}
	}, [
		synced,
		lastMessageConfig,
		setOverrideConfig,
		setSyncChatId,
		client.setStorage,
	]);

	const { providers } = useProviders();
	const fallbackConfig = useMemo(() => {
		const provider = providers.data
			?.filter(
				(provider): provider is ProviderState<ModelProviderStatus> =>
					provider.type === "model",
			)
			.find((s) => s.status.models.length > 0);
		if (!provider) return null;
		return zConfig.parse({
			provider: provider.name,
			model: provider.status.models[0].name,
		});
	}, [providers]);

	const config = useMemo(() => {
		return (
			(syncing ? lastMessageConfig : null) ??
			overrideConfig ??
			lastConfig ??
			fallbackConfig ??
			zConfig.parse({
				model: "",
				provider: "",
			})
		);
	}, [syncing, lastMessageConfig, overrideConfig, lastConfig, fallbackConfig]);

	const setConfig = useCallback(
		(value: zConfig) => {
			console.log("[useConfig] set config:", value);
			setOverrideConfig(value);
			client.setStorage("config", value);
		},
		[setOverrideConfig, client.setStorage],
	);

	const { model, modelArgs, setModel, setModelArg } = useConfigEditor({
		config,
		setConfig,
	});

	return {
		config,
		setConfig,
		model,
		modelArgs,
		providers,
		setModel,
		setModelArg,
	};
};
