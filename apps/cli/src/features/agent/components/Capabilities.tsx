import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useSkills } from "@tiny-chat/client/src/features/agent/hooks/useSkills.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/src/features/editor/types/completion.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import chalk from "chalk";
import { useMemo } from "react";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";

interface CapabilityGroup extends CompletionGroup<CapabilityItem> {}

interface CapabilityItem extends CompletionItem {
	detail?: string;
	enabled: boolean;
	disabled?: boolean;
	error?: unknown;
	toggle: () => void;
}

export default function Capabilities() {
	const { config, setConfig } = useConfig();
	const { nativeTools, mcpTools } = useTools();
	const { nativeSkills, localSkills } = useSkills();

	const { page } = usePage();

	useWorkingStatus(nativeTools, mcpTools, nativeSkills, localSkills);

	const groups = useMemo((): CapabilityGroup[] => {
		if (page === "tools") {
			const buildToolsets = (
				type: string,
				toolsets: Toolset<any>[],
			): CapabilityGroup => {
				return {
					name: type,
					items: toolsets.map((toolset) => {
						const name = ToolUtils.name({ toolset });
						const toolNames = toolset.tools.map((tool) =>
							ToolUtils.name({ toolset, tool }),
						);
						const enabled = ToolUtils.checkOne({ toolset, config });

						return {
							name,
							value: name,
							detail: toolNames.join(", "),
							enabled,
							disabled: !toolset.status.valid,
							error: toolset.status.error,
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
					}),
				};
			};

			return [
				buildToolsets("Native", nativeTools.data ?? []),
				buildToolsets("MCP", mcpTools.data ?? []),
			];
		} else if (page === "skills") {
			const buildSkills = (type: string, skills: zSkill[]): CapabilityGroup => {
				return {
					name: type,
					items: skills.map((skill) => {
						const enabled = !!config.skills?.includes(skill.path);
						return {
							name: skill.name,
							value: skill.path,
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
					}),
				};
			};
			return [
				buildSkills("Native", nativeSkills.data ?? []),
				buildSkills("Local", localSkills.data ?? []),
			];
		}

		return [];
	}, [
		page,
		config,
		setConfig,
		nativeTools.data,
		mcpTools.data,
		nativeSkills.data,
		localSkills.data,
	]);

	return (
		<Completions<CapabilityGroup, CapabilityItem>
			groups={groups}
			renderItem={({ item }) => {
				return (
					<Text
						color={item.error ? "redBright" : undefined}
						dimColor={item.disabled ? true : undefined}
					>
						{chalk.dim("[")}
						<Text color="primary">{item.enabled ? "x" : " "}</Text>
						{chalk.dim("]")}
						{` `}
						{item.name}
						<Text color={item.error ? "redBright" : "textSubtle"}>
							{item.error ? ` · ${CommonUtils.formatError(item)}` : ""}
							{item.detail ? ` · ${item.detail}` : ""}
						</Text>
					</Text>
				);
			}}
			renderEmpty={() => "nothing here yet"}
			onInput={({ item, key, input }) => {
				if ((key.return || input === " ") && item) {
					item.toggle();
				}
			}}
			actions={["back"]}
		/>
	);
}
