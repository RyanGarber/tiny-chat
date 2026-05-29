import { MultiSelect, Select, SelectProps, type MultiSelectProps } from '@mantine/core';
import { DEFAULT_SKILLS, DEFAULT_TOOL_GROUPS, zConfig } from '@tiny-chat/shared/src/types/chat.ts';
import { useHiddenModels } from '@/features/settings/hooks/useHiddenModels';
import { useProviders } from '../hooks/useProviders';

const getData = (
  feature: 'generate' | 'embed',
  includeHidden: boolean,
  providers: ReturnType<typeof useProviders>['providers'],
  hiddenModels: ReturnType<typeof useHiddenModels>['hiddenModels'],
) => {
  return providers.data?.chat
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(
      (p) =>
        includeHidden ||
        p.models.some(
          (m) =>
            !hiddenModels.data?.[feature].find((h) => h.provider === p.name && h.model === m.name),
        ),
    )
    .map((p) => ({
      group: p.name,
      items: p.models
        .filter((m) => m.features.includes(feature))
        .filter(
          (m) =>
            includeHidden ||
            !hiddenModels.data?.[feature].find((h) => h.provider === p.name && h.model === m.name),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({
          label: m.name,
          value: JSON.stringify({ provider: p.name, model: m.name }),
        })),
    }));
};

interface ModelSelectProps extends SelectProps {
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
    <Select
      required={!optional}
      allowDeselect={optional} // TODO - remove `| null` type when !optional
      maxDropdownHeight={250}
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

interface ModelMultiSelectProps extends MultiSelectProps {
  feature: 'generate' | 'embed';
  configValue: zConfig[];
  onConfigChange: (value: zConfig[]) => void;
  includeHidden?: boolean;
}

export function ModelMultiSelect({
  feature,
  configValue,
  onConfigChange,
  includeHidden = false,
  ...multiSelectProps
}: ModelMultiSelectProps) {
  const { providers } = useProviders();
  const { hiddenModels } = useHiddenModels();
  const data = getData(feature, includeHidden, providers, hiddenModels);
  return (
    <MultiSelect
      maxDropdownHeight={250}
      data={data}
      value={configValue.map((v) => JSON.stringify({ provider: v.provider, model: v.model }))}
      onChange={(value) => onConfigChange(value.map((v) => zConfig.parse(JSON.parse(v))) ?? [])}
      {...multiSelectProps}
    />
  );
}
