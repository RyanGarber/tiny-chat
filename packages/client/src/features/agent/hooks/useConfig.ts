import { useCallback, useContext, useEffect, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { useConfigEditor } from "#client/features/agent/hooks/useConfigEditor.ts";
import { useProviders } from "#client/features/agent/hooks/useProviders.ts";
import { useConfigStore } from "#client/features/agent/stores/useConfigStore.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMessages } from "#client/features/message/hooks/useMessages.ts";
import { useHiddenModels } from "#client/features/settings/hooks/useHiddenModels.ts";
import { zConfig } from "#core/features/data/types/message.ts";
import { ModelProviderUtils } from "#core/features/provider/utils/ModelProviderUtils.ts";

export type ConfigStatus = "loading" | "ready" | "unavailable";

const EMPTY_CONFIG = zConfig.parse({ provider: "", model: "" });

export const useConfig = () => {
	const client = useContext(ClientContext);

	const chatId = useChatStore((s) => s.active.chatId);
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
		const messageList = messages.data?.messages ?? [];
		const lastMessage = messageList.reduce((current, candidate) => {
			return Temporal.PlainDateTime.compare(
				candidate.createdAt,
				current.createdAt,
			) > 0
				? candidate
				: current;
		}, messageList[0]);
		return lastMessage?.config ?? null;
	}, [messages.data]);

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
	const { hiddenModels } = useHiddenModels();

	/**
	 * What was chosen, checked against what is on offer once providers load: a
	 * model since removed, or none chosen at all, falls back to one that exists.
	 * Depends on the data rather than the query result, whose identity changes on
	 * every render.
	 */
	const { config, status } = useMemo((): {
		config: zConfig;
		status: ConfigStatus;
	} => {
		const candidates = [
			syncing ? lastMessageConfig : null,
			overrideConfig,
			lastConfig,
		];
		const chosen = candidates.find((candidate) => !!candidate) ?? EMPTY_CONFIG;
		if (!providers.data) {
			return {
				config: chosen,
				status: providers.isError ? "unavailable" : "loading",
			};
		}
		const valid = ModelProviderUtils.getConfigValid({
			candidates,
			providers: providers.data,
			hidden: hiddenModels.language,
		});
		return valid
			? { config: valid, status: "ready" }
			: { config: chosen, status: "unavailable" };
	}, [
		syncing,
		lastMessageConfig,
		overrideConfig,
		lastConfig,
		providers.data,
		providers.isError,
		hiddenModels.language,
	]);

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
		/**
		 * `unavailable` when no language model is on offer, in which case `config`
		 * is the last one chosen and cannot be sent with.
		 */
		status,
		setConfig,
		model,
		modelArgs,
		providers,
		setModel,
		setModelArg,
	};
};
