import {
	type TreeNodeData,
	TreeSelect,
	type TreeSelectProps,
} from "@mantine/core";
import { useProviders } from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import { useHiddenModels } from "@tiny-chat/client/src/features/settings/hooks/useHiddenModels.ts";
import {
	DEFAULT_SKILLS,
	DEFAULT_TOOLSETS,
	zConfig,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type {
	ModelProviderStatus,
	zModelFeature,
} from "@tiny-chat/core/src/features/provider/types/model";
import type { ProviderState } from "@tiny-chat/core/src/features/provider/types/provider";
import { useCallback, useMemo } from "react";

const getData = (
	feature: zModelFeature,
	includeHidden: boolean,
	providers: ReturnType<typeof useProviders>["providers"],
	hiddenModels: ReturnType<typeof useHiddenModels>["hiddenModels"],
): TreeNodeData[] => {
	return (
		providers.data
			?.filter(
				(provider): provider is ProviderState<ModelProviderStatus> =>
					provider.type === "model",
			)
			.sort((a, b) => a.name.localeCompare(b.name))
			.filter(
				(p) =>
					p.status.models.length &&
					(includeHidden ||
						p.status.models
							.filter((m) => m.features.includes(feature))
							.some(
								(m) =>
									!hiddenModels.data?.[feature]?.find(
										(h) => h.provider === p.name && h.model === m.name,
									),
							)),
			)
			.map((p) => ({
				label: p.name,
				value: p.name,
				children: p.status.models
					.filter((m) => m.features.includes(feature))
					.filter(
						(m) =>
							includeHidden ||
							!hiddenModels.data?.[feature]?.find(
								(h) => h.provider === p.name && h.model === m.name,
							),
					)
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((m) => ({
						label: m.name,
						value: JSON.stringify({ provider: p.name, model: m.name }),
					})),
			})) ?? []
	);
};

interface ModelSelectProps extends Omit<TreeSelectProps, "data"> {
	feature: zModelFeature;
	optional?: boolean;
	configValue: zConfig | null | undefined;
	onConfigChange: (value: zConfig | null | undefined) => void;
	includeHidden?: boolean;
}

export default function ModelSelect({
	feature,
	optional = false,
	configValue,
	onConfigChange,
	includeHidden = false,
	...selectProps
}: ModelSelectProps) {
	const { providers } = useProviders();
	const { hiddenModels } = useHiddenModels();
	const data = getData(feature, includeHidden, providers, hiddenModels);
	return (
		<TreeSelect
			required={!optional}
			allowDeselect={optional}
			maxDropdownHeight={250}
			expandOnClick
			scrollAreaProps={{ type: "auto" }}
			data={data}
			value={
				configValue
					? JSON.stringify({
							provider: configValue.provider,
							model: configValue.model,
						})
					: null
			}
			onChange={(v) =>
				onConfigChange(
					v
						? zConfig.parse({
								...JSON.parse(v),
								args: {},
								toolsets: configValue?.toolsets ?? DEFAULT_TOOLSETS,
								skills: configValue?.skills ?? DEFAULT_SKILLS,
							})
						: null,
				)
			}
			{...selectProps}
		/>
	);
}

interface ModelMultiSelectProps
	extends Omit<TreeSelectProps<"checkbox">, "data"> {
	feature: zModelFeature;
	configValues: zConfig[];
	onConfigChange: (value: zConfig[]) => void;
	includeHidden?: boolean;
	invert?: boolean;
}

export function ModelMultiSelect({
	feature,
	configValues,
	onConfigChange,
	includeHidden = false,
	invert = false,
	...multiSelectProps
}: ModelMultiSelectProps) {
	const { providers } = useProviders();
	const { hiddenModels } = useHiddenModels();
	const data = getData(feature, includeHidden, providers, hiddenModels);

	let values: string[];
	if (invert) {
		values = data
			.flatMap((p) => p.children?.map((m) => m.value) ?? [])
			.filter(
				(available) =>
					!configValues.some(
						(selected) =>
							selected.provider ===
								(JSON.parse(available) as zConfig).provider &&
							selected.model === (JSON.parse(available) as zConfig).model,
					),
			);
	} else {
		values = configValues.map((v) =>
			JSON.stringify({ provider: v.provider, model: v.model }),
		);
	}

	const onChange = useCallback(
		(value: string[]) => {
			if (invert) {
				onConfigChange(
					data
						.flatMap((p) => p.children?.map((m) => m.value) ?? [])
						.filter(
							(available) =>
								!value.some(
									(selected) =>
										(JSON.parse(selected) as zConfig).provider ===
											(JSON.parse(available) as zConfig).provider &&
										(JSON.parse(selected) as zConfig).model ===
											(JSON.parse(available) as zConfig).model,
								),
						)
						.map((v) => zConfig.parse(JSON.parse(v))),
				);
			} else {
				onConfigChange(value.map((v) => zConfig.parse(JSON.parse(v))));
			}
		},
		[data, invert, onConfigChange],
	);

	return (
		<TreeSelect
			maxDropdownHeight={250}
			data={data}
			mode="multiple"
			expandOnClick
			clearable
			value={useMemo(() => values, [values])}
			onChange={useCallback((value: string[]) => onChange(value), [onChange])}
			{...multiSelectProps}
		/>
	);
}
