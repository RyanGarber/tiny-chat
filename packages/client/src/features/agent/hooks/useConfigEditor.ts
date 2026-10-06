import { useCallback, useMemo } from "react";
import { useProviders } from "#client/features/agent/hooks/useProviders.ts";
import { zConfig } from "#core/features/data/types/message.ts";
import type { ModelProviderStatus } from "#core/features/provider/types/model.ts";
import type { ProviderState } from "#core/features/provider/types/provider.ts";
import { ModelProviderUtils } from "#core/features/provider/utils/ModelProviderUtils.ts";

/**
 * Edits one config — the chat's, or one kept in settings such as the
 * subagent's. Without a config yet, only picking a model starts one.
 */
export const useConfigEditor = ({
	config,
	setConfig,
}: {
	config: zConfig | null;
	setConfig: (config: zConfig) => void;
}) => {
	const { providers } = useProviders();

	const getModel = useCallback(
		(config: Pick<zConfig, "provider" | "model">) =>
			providers.data
				?.filter(
					(provider): provider is ProviderState<ModelProviderStatus> =>
						provider.type === "model",
				)
				.find((s) => s.name === config.provider)
				?.status.models.find((m) => m.name === config.model),
		[providers.data],
	);

	const provider = config?.provider;
	const modelName = config?.model;
	const model = useMemo(
		() =>
			provider && modelName
				? getModel({ provider, model: modelName })
				: undefined,
		[getModel, provider, modelName],
	);
	const modelArgs = useMemo(() => model?.args ?? [], [model]);

	/** Switches model, keeping any args the new model also accepts. */
	const setModel = useCallback(
		(value: Pick<zConfig, "provider" | "model">) => {
			setConfig(
				zConfig.parse({
					...config,
					provider: value.provider,
					model: value.model,
					args: ModelProviderUtils.getArgsValid({
						args: config?.args ?? {},
						modelArgs: getModel(value)?.args ?? [],
					}),
				}),
			);
		},
		[config, setConfig, getModel],
	);

	const setModelArg = useCallback(
		(name: string, value: unknown) => {
			if (!config) return;
			setConfig({ ...config, args: { ...config.args, [name]: value } });
		},
		[config, setConfig],
	);

	const toggleToolset = useCallback(
		(name: string) => {
			if (!config) return;
			setConfig({
				...config,
				toolsets: config.toolsets.includes(name)
					? config.toolsets.filter((other) => other !== name)
					: [...config.toolsets, name],
			});
		},
		[config, setConfig],
	);

	const toggleSkill = useCallback(
		(path: string) => {
			if (!config) return;
			setConfig({
				...config,
				skills: config.skills.includes(path)
					? config.skills.filter((other) => other !== path)
					: [...config.skills, path],
			});
		},
		[config, setConfig],
	);

	return {
		providers,
		getModel,
		model,
		modelArgs,
		setModel,
		setModelArg,
		toggleToolset,
		toggleSkill,
	};
};
