import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useSkills } from "@tiny-chat/client/src/features/agent/hooks/useSkills.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { Box, Text, useInput, useWindowSize } from "ink";
import { ScrollList } from "ink-scroll-list";
import { useMemo, useState } from "react";
import HelpText from "../../../core/components/HelpText.tsx";
import { useLoadingStatus } from "../../../core/hooks/useLoadingStatus.ts";

type Mode = "tools" | "skills";

interface MenuItem {
	key: string;
	group: string;
	label: string;
	detail?: string;
	enabled: boolean;
	disabled?: boolean;
	toggle: () => void;
}

export default function CapabilitySelect({ mode }: { mode: Mode }) {
	const { rows } = useWindowSize();

	const { config, setConfig } = useConfig();
	const { nativeTools, mcpTools } = useTools();
	const { nativeSkills, localSkills } = useSkills();

	useLoadingStatus(nativeTools, mcpTools, nativeSkills, localSkills);

	const items = useMemo((): MenuItem[] => {
		if (mode === "tools") {
			const toToolItems = (
				group: string,
				toolsets: Toolset<any>[],
			): MenuItem[] =>
				toolsets.map((toolset) => {
					const name = ToolUtils.name({ toolset });
					const toolNames = toolset.tools.map((tool) =>
						ToolUtils.name({ toolset, tool }),
					);
					const enabled = ToolUtils.checkOne({ toolset, config });
					return {
						key: `tool:${name}`,
						group,
						label: name,
						detail: toolNames.join(", "),
						enabled,
						disabled: !toolset.status.valid,
						toggle: () => {
							if (!toolset.status.valid) return;
							const toolsets = config.toolsets ?? [];
							setConfig({
								...config,
								toolsets: enabled
									? toolsets.filter((other) => other !== name)
									: [...toolsets, name],
							});
						},
					};
				});

			return [
				...toToolItems("Native", nativeTools.data ?? []),
				...toToolItems("MCP", mcpTools.data ?? []),
			];
		}

		const toSkillItems = (group: string, skills: zSkill[]): MenuItem[] =>
			skills.map((skill) => {
				const enabled = !!config.skills?.includes(skill.path);
				return {
					key: `skill:${skill.path}`,
					group,
					label: skill.name || "(unnamed)",
					detail: DataUtils.getTextCleaned({
						data: skill.description,
						maxLength: 60,
					}),
					enabled,
					disabled: !skill.name,
					toggle: () => {
						if (!skill.name) return;
						const skills = config.skills ?? [];
						setConfig({
							...config,
							skills: enabled
								? skills.filter((path) => path !== skill.path)
								: [...skills, skill.path],
						});
					},
				};
			});

		return [
			...toSkillItems("Native", nativeSkills.data ?? []),
			...toSkillItems("Local", localSkills.data ?? []),
		];
	}, [
		mode,
		config,
		setConfig,
		nativeTools.data,
		mcpTools.data,
		nativeSkills.data,
		localSkills.data,
	]);

	const [selected, setSelected] = useState(0);
	const index = Math.min(selected, Math.max(items.length - 1, 0));

	useInput((input, key) => {
		if (key.upArrow) {
			setSelected((previous) => Math.max(previous - 1, 0));
		}
		if (key.downArrow) {
			setSelected((previous) =>
				Math.min(previous + 1, Math.max(items.length - 1, 0)),
			);
		}
		if (key.return || input === " ") {
			items[index]?.toggle();
		}
	});

	return (
		<Box flexDirection="column" flexGrow={1}>
			<ScrollList
				selectedIndex={index}
				height={Math.max(rows - 3, 5)}
				borderColor="blueBright"
				borderStyle="round"
			>
				{items.length === 0 ? (
					<Text color="gray">Nothing here yet</Text>
				) : (
					items.map((item, itemIndex) => {
						const showGroup =
							itemIndex === 0 || items[itemIndex - 1]?.group !== item.group;
						const isSelected = itemIndex === index;
						return (
							<Box key={item.key} flexDirection="column">
								{showGroup && <Text color="gray">--- {item.group} ---</Text>}
								<Text
									color={
										item.disabled
											? "gray"
											: isSelected
												? "blue"
												: item.enabled
													? "green"
													: "white"
									}
									dimColor={item.disabled}
								>
									{isSelected ? "▶ " : "  "}
									{item.enabled ? "[x]" : "[ ]"} {item.label}
									{item.detail ? ` · ${item.detail}` : ""}
								</Text>
							</Box>
						);
					})
				)}
			</ScrollList>
			<HelpText
				actions={[
					{ key: "↑↓", name: "choose" },
					{ key: "space", name: "toggle" },
					{ key: "esc", name: "back" },
				]}
			/>
		</Box>
	);
}
