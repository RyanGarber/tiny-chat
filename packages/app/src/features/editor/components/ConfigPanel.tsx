import { Box, Group, Select, Slider, Stack, Text } from "@mantine/core";
import { useConfigEditor } from "@tiny-chat/client/features/agent/hooks/useConfigEditor.ts";
import { useSkills } from "@tiny-chat/client/features/agent/hooks/useSkills.ts";
import { useTools } from "@tiny-chat/client/features/agent/hooks/useTools.ts";
import type { zConfig } from "@tiny-chat/core/features/data/types/message.ts";
import { ToolUtils } from "@tiny-chat/core/features/tool/utils/ToolUtils.ts";
import { useMemo, useState } from "react";
import ModelSelect from "#app/core/components/ModelSelect.tsx";
import type { CapabilitiesType } from "#app/core/stores/useAppStore.ts";
import CapabilityMenu, {
	type CapabilityMenuItem,
} from "#app/features/editor/components/CapabilityMenu.tsx";

/** Follows the drag itself, and only sets the arg once it is let go. */
function ArgSlider({
	min,
	max,
	value,
	onChange,
	disabled,
}: {
	min: number;
	max: number;
	value: number;
	onChange: (value: number) => void;
	disabled?: boolean;
}) {
	const [dragged, setDragged] = useState<number | null>(null);

	return (
		<Slider
			min={min}
			max={max}
			step={(max - min) / 50}
			value={dragged ?? value}
			onChange={setDragged}
			onChangeEnd={(value) => {
				setDragged(null);
				onChange(value);
			}}
			disabled={disabled}
		/>
	);
}

/**
 * A config's model, tools, skills and model args — the chat's in the editor,
 * or one kept in settings, such as the subagent's.
 */
export default function ConfigPanel({
	config,
	setConfig,
	onClear,
	onMore,
	disabled,
	className,
	zIndex,
}: {
	config: zConfig | null;
	setConfig: (config: zConfig) => void;
	/** Lets the model be unset, which is what clears the config. */
	onClear?: () => void;
	/** Opens the full capabilities modal from the tools and skills menus. */
	onMore?: (capabilities: CapabilitiesType) => void;
	disabled?: boolean;
	/** Given to every dropdown, which portal outside the panel. */
	className?: string;
	zIndex?: number;
}) {
	const { modelArgs, setModel, setModelArg, toggleToolset, toggleSkill } =
		useConfigEditor({ config, setConfig });

	const { toolsets } = useTools();
	const toolItems = useMemo(
		(): CapabilityMenuItem[] =>
			config
				? toolsets.map((toolset) => {
						const name = ToolUtils.name({ toolset });
						return {
							key: name,
							name,
							checked: ToolUtils.checkOne({ toolset, config }),
							disabled: !toolset.status.valid,
							onToggle: () => toggleToolset(name),
						};
					})
				: [],
		[toolsets, config, toggleToolset],
	);

	const { skills } = useSkills();
	const skillItems = useMemo(
		(): CapabilityMenuItem[] =>
			config
				? skills.map((skill) => ({
						key: skill.path,
						name: skill.name,
						checked: config.skills.includes(skill.path),
						disabled: !skill.name,
						onToggle: () => toggleSkill(skill.path),
					}))
				: [],
		[skills, config, toggleSkill],
	);

	const enabledTools = useMemo(
		() => (config ? ToolUtils.checkAll({ toolsets, config }).tools.length : 0),
		[toolsets, config],
	);
	const enabledSkills = skillItems.filter((item) => item.checked).length;

	return (
		<>
			<ModelSelect
				flex={1}
				variant="subtle"
				comboboxProps={{ offset: 0, zIndex }}
				classNames={{ dropdown: className }}
				configValue={config}
				onConfigChange={(value) => {
					if (value) setModel(value);
					else onClear?.();
				}}
				optional={!!onClear}
				placeholder="No model"
				feature="language"
				disabled={disabled}
			/>
			{config && (
				<>
					<Group gap={0} wrap="nowrap">
						<CapabilityMenu
							label={`${enabledTools} TOOL${enabledTools !== 1 ? "S" : ""}`}
							items={toolItems}
							disabled={disabled}
							onMore={onMore && (() => onMore("tools:native"))}
							className={className}
							zIndex={zIndex}
						/>
						<Text c="dimmed" size="xs">
							&middot;
						</Text>
						<CapabilityMenu
							label={`${enabledSkills} SKILL${enabledSkills !== 1 ? "S" : ""}`}
							items={skillItems}
							disabled={disabled}
							onMore={onMore && (() => onMore("skills:native"))}
							className={className}
							zIndex={zIndex}
						/>
					</Group>
					<Stack gap="xs" mt={5}>
						{modelArgs.map((arg) => (
							<Box key={arg.name}>
								<Text size="xs" mb={2} c="dimmed">
									{arg.name}
								</Text>
								{arg.type === "list" && (
									<Select
										data={arg.values}
										size="xs"
										value={
											(config.args as Record<string, string> | undefined)?.[
												arg.name
											] ?? arg.default
										}
										comboboxProps={{ offset: 0, position: "top", zIndex }}
										onChange={(value) => setModelArg(arg.name, value)}
										disabled={disabled}
										classNames={{ dropdown: className }}
									/>
								)}
								{arg.type === "range" && (
									<ArgSlider
										min={arg.min}
										max={arg.max}
										value={
											(config.args as Record<string, number> | undefined)?.[
												arg.name
											] ?? arg.default
										}
										onChange={(value) => setModelArg(arg.name, value)}
										disabled={disabled}
									/>
								)}
							</Box>
						))}
					</Stack>
				</>
			)}
		</>
	);
}
