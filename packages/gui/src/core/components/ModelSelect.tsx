import {
	type TreeNodeData,
	TreeSelect,
	type TreeSelectProps,
} from "@mantine/core";
import { useCallback, useMemo } from "react";
import { useProviders } from "#client/features/agent/hooks/useProviders.ts";
import { useHiddenModels } from "#client/features/settings/hooks/useHiddenModels.ts";
import { zConfig } from "#core/features/data/types/message.ts";
import type { zSettings } from "#core/features/data/types/user.ts";
import type { ModelProviderStatus } from "#core/features/provider/types/model.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "#core/features/provider/types/provider.ts";

const getData = (
	feature: keyof NonNullable<zSettings["hiddenModels"]>,
	includeHidden: boolean,
	hiddenModels: zSettings["hiddenModels"],
	providers?: ProviderState<ProviderStatus>[],
	/** Listed even when hidden, as the one already chosen. */
	selected?: Pick<zConfig, "provider" | "model"> | null,
): TreeNodeData[] => {
	const isShown = (provider: string, model: string) =>
		includeHidden ||
		(selected?.provider === provider && selected.model === model) ||
		!hiddenModels?.[feature]?.find(
			(h) => h.provider === provider && h.model === model,
		);
	return (
		providers
			?.filter(
				(provider): provider is ProviderState<ModelProviderStatus> =>
					provider.type === "model",
			)
			.sort((a, b) => a.name.localeCompare(b.name))
			.filter(
				(p) =>
					p.status.models.length &&
					p.status.models
						.filter((m) => m.features.includes(feature))
						.some((m) => isShown(p.name, m.name)),
			)
			.map((p) => ({
				label: p.name,
				value: p.name,
				children: p.status.models
					.filter((m) => m.features.includes(feature))
					.filter((m) => isShown(p.name, m.name))
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((m) => ({
						label: m.name,
						value: JSON.stringify({ provider: p.name, model: m.name }),
					})),
			})) ?? []
	);
};

interface ModelSelectProps extends Omit<TreeSelectProps, "data"> {
	feature: keyof NonNullable<zSettings["hiddenModels"]>;
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
	const data = getData(
		feature,
		includeHidden,
		hiddenModels,
		providers.data,
		configValue,
	);
	const value = configValue
		? JSON.stringify({
				provider: configValue.provider,
				model: configValue.model,
			})
		: null;
	// A value missing from the tree would be shown as its raw JSON.
	const known =
		!!value && data.some((p) => p.children?.some((m) => m.value === value));
	const missing =
		configValue?.model && !known && providers.isFetched
			? `${configValue.model} is unavailable`
			: undefined;
	return (
		<TreeSelect
			required={!optional}
			allowDeselect={optional}
			maxDropdownHeight={250}
			expandOnClick
			scrollAreaProps={{ type: "auto" }}
			data={data}
			value={known ? value : null}
			error={missing}
			onChange={(v) =>
				onConfigChange(
					v
						? zConfig.parse({
								...JSON.parse(v),
								toolsets: configValue?.toolsets,
								skills: configValue?.skills,
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
	feature: keyof NonNullable<zSettings["hiddenModels"]>;
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
	const data = getData(feature, includeHidden, hiddenModels, providers.data);

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
