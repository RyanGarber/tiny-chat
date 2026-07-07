import { type TreeNodeData, TreeSelect, TreeSelectProps } from '@mantine/core';
import { DEFAULT_SKILLS, DEFAULT_TOOL_GROUPS, zConfig } from '@tiny-chat/shared/src/types/chat.ts';
import { useHiddenModels } from '@/features/settings/hooks/useHiddenModels.ts';
import { useProviders } from '@/features/config/hooks/useProviders.ts';
import { useCallback, useMemo } from 'react';

const getData = (
  feature: 'generate' | 'embed',
  includeHidden: boolean,
  providers: ReturnType<typeof useProviders>['providers'],
  hiddenModels: ReturnType<typeof useHiddenModels>['hiddenModels'],
): TreeNodeData[] => {
  return (
    providers.data?.chat
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(
        (p) =>
          p.models.length &&
          (includeHidden ||
            p.models
              .filter((m) => m.features.includes(feature))
              .some(
                (m) =>
                  !hiddenModels.data?.[feature].find(
                    (h) => h.provider === p.name && h.model === m.name,
                  ),
              )),
      )
      .map((p) => ({
        label: p.name,
        value: p.name,
        children: p.models
          .filter((m) => m.features.includes(feature))
          .filter(
            (m) =>
              includeHidden ||
              !hiddenModels.data?.[feature].find(
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

interface ModelSelectProps extends Omit<TreeSelectProps<'single'>, 'data'> {
  feature: 'generate' | 'embed';
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
      data={data}
      value={
        configValue
          ? JSON.stringify({ provider: configValue.provider, model: configValue.model })
          : null
      }
      onChange={(v) =>
        onConfigChange(
          v
            ? zConfig.parse({
                ...JSON.parse(v),
                toolGroups: configValue?.toolGroups ?? DEFAULT_TOOL_GROUPS,
                skills: configValue?.skills ?? DEFAULT_SKILLS,
              })
            : null,
        )
      }
      {...selectProps}
    />
  );
}

interface ModelMultiSelectProps extends Omit<TreeSelectProps<'checkbox'>, 'data'> {
  feature: 'generate' | 'embed';
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
              selected.provider === (JSON.parse(available) as zConfig).provider &&
              selected.model === (JSON.parse(available) as zConfig).model,
          ),
      );
  } else {
    values = configValues.map((v) => JSON.stringify({ provider: v.provider, model: v.model }));
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
