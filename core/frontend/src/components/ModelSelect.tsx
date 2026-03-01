import {Select, SelectProps} from "@mantine/core";
import {zConfig, zConfigType} from "@tiny-chat/core-backend/types.ts";
import {useServices} from "@/managers/services.tsx";
import {ModelFeature} from "@/services";

interface ModelSelectProps extends SelectProps {
    feature: ModelFeature;
    optional?: boolean;
    configValue: zConfigType | null | undefined;
    onConfigChange: (value: zConfigType | null | undefined) => void;
}

export default function ModelSelect({
                                        feature,
                                        optional = false,
                                        configValue,
                                        onConfigChange,
                                        ...selectProps
                                    }: ModelSelectProps) {
    const {services} = useServices();
    return (
        <Select
            required={!optional}
            allowDeselect={optional} // TODO - remove `| null` type when !optional
            maxDropdownHeight={250}
            data={services.map((s) => ({
                group: s.name,
                items: s.models.filter(m => m.features.includes(feature)).sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({
                    label: m.name,
                    value: JSON.stringify({service: s.name, model: m.name} satisfies zConfigType),
                })),
            }))}
            value={configValue ? JSON.stringify({service: configValue.service, model: configValue.model}) : null}
            onChange={(v) => onConfigChange(v ? zConfig.parse(JSON.parse(v)) : null)}
            {...selectProps}
        />
    )
}
