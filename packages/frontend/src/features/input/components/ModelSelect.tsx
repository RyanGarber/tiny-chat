import { MultiSelect, Select, SelectProps, type MultiSelectProps } from '@mantine/core';
import { DEFAULT_SKILLS, DEFAULT_TOOL_GROUPS, zConfig } from '@tiny-chat/shared/src/types/chat.ts';
import { usePreferredModels } from '@/features/settings/hooks/usePreferredModels';
import { useProviders } from '../hooks/useProviders';

interface ModelSelectProps extends SelectProps {
  feature: 'generate' | 'embed';
  optional?: boolean;
  configValue: zConfig | null | undefined;
  onConfigChange: (value: zConfig | null | undefined) => void;
  preferredOnly?: boolean;
}

export default function ModelSelect({
  feature,
  optional = false,
  configValue,
  onConfigChange,
  preferredOnly = false,
  ...selectProps
}: ModelSelectProps) {
  const { providers } = useProviders();
  const { preferredModels } = usePreferredModels();
  return (
    <Select
      required={!optional}
      allowDeselect={optional} // TODO - remove `| null` type when !optional
      maxDropdownHeight={250}
      data={providers.data?.chat
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          (s) =>
            !preferredOnly || preferredModels.data?.[feature].some((m) => m.provider === s.name),
        )
        .map((s) => ({
          group: s.name,
          items: s.models
            .filter((m) => m.features.includes(feature))
            .filter(
              (m) =>
                !preferredOnly ||
                preferredModels.data?.[feature].some(
                  (pm) => pm.provider === s.name && pm.model === m.name,
                ),
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((m) => ({
              label: m.name,
              value: JSON.stringify({ provider: s.name, model: m.name }),
            })),
        }))}
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
  preferredOnly?: boolean;
}

export function ModelMultiSelect({
  feature,
  configValue,
  onConfigChange,
  preferredOnly = false,
  ...multiSelectProps
}: ModelMultiSelectProps) {
  const { providers } = useProviders();
  const { preferredModels } = usePreferredModels();
  return (
    <MultiSelect
      maxDropdownHeight={250}
      data={providers.data?.chat
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          (s) =>
            !preferredOnly || preferredModels.data?.[feature].some((m) => m.provider === s.name),
        )
        .map((s) => ({
          group: s.name,
          items: s.models
            .filter((m) => m.features.includes(feature))
            .filter(
              (m) =>
                !preferredOnly ||
                preferredModels.data?.[feature].some(
                  (pm) => pm.provider === s.name && pm.model === m.name,
                ),
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((m) => ({
              label: m.name,
              value: JSON.stringify({ provider: s.name, model: m.name }),
            })),
        }))}
      value={configValue.map((v) => JSON.stringify({ provider: v.provider, model: v.model }))}
      onChange={(value) => onConfigChange(value.map((v) => zConfig.parse(JSON.parse(v))) ?? [])}
      {...multiSelectProps}
    />
  );
}
