import { useConfigEditor } from "@tiny-chat/client/features/agent/hooks/useConfigEditor.ts";
import { useSkills } from "@tiny-chat/client/features/agent/hooks/useSkills.ts";
import { useTools } from "@tiny-chat/client/features/agent/hooks/useTools.ts";
import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/features/editor/types/completion.ts";
import { useModelSettings } from "@tiny-chat/client/features/settings/hooks/useModelSettings.ts";
import type { zModelArg } from "@tiny-chat/core/features/provider/types/model.ts";
import { ToolUtils } from "@tiny-chat/core/features/tool/utils/ToolUtils.ts";
import chalk from "chalk";
import { useMemo, useState } from "react";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import Completions from "../../editor/components/Completions.tsx";
import Choice from "../../settings/components/Choice.tsx";
import ModelChoice from "../../settings/components/ModelChoice.tsx";

interface ConfigItem extends CompletionItem {
	/** A setting shows its value; a toggle shows a checkbox. */
	state?: string;
	enabled?: boolean;
	disabled?: boolean;
	arg?: zModelArg;
	onSelect?: () => void;
}

/**
 * The subagent's model, model args, tools and skills — what the chat sets
 * from its own config, kept in settings and opened from its toolset.
 */
export default function SubagentConfig() {
	const { subagentConfig: config, updateSubagentConfig } = useModelSettings();
	const { modelArgs, setModel, setModelArg, toggleToolset, toggleSkill } =
		useConfigEditor({ config, setConfig: updateSubagentConfig });
	const { toolsets } = useTools();
	const { skills } = useSkills();

	// A model or a list arg is picked on a page of its own.
	const [route, setRoute] = useState<string | null>(null);
	const [selected, setSelected] = useState(0);

	const { setPage } = usePage({
		onBack: () => {
			if (route) setRoute(null);
			else setPage("tools");
			return false;
		},
	});

	const args = (config?.args ?? {}) as Record<string, unknown>;

	const groups = useMemo((): CompletionGroup<ConfigItem>[] => {
		const model: CompletionGroup<ConfigItem> = {
			name: "Model",
			items: [
				{
					name: "model",
					value: "model",
					state: config?.model,
					onSelect: () => setRoute("model"),
				},
				...modelArgs.map((arg) => ({
					name: arg.name,
					value: `arg:${arg.name}`,
					state: String(args[arg.name] ?? arg.default),
					arg,
					onSelect:
						arg.type === "list" ? () => setRoute(`arg:${arg.name}`) : undefined,
				})),
			],
		};
		if (!config) return [model];

		return [
			model,
			{
				name: "Tools",
				items: toolsets.map((toolset) => {
					const name = ToolUtils.name({ toolset });
					return {
						name,
						value: `toolset:${name}`,
						enabled: ToolUtils.checkOne({ toolset, config }),
						disabled: !toolset.status.valid,
						onSelect: () => toggleToolset(name),
					};
				}),
			},
			{
				name: "Skills",
				items: skills.map((skill) => ({
					name: skill.name,
					value: `skill:${skill.path}`,
					enabled: config.skills.includes(skill.path),
					disabled: !skill.name,
					onSelect: () => toggleSkill(skill.path),
				})),
			},
		];
	}, [config, args, modelArgs, toolsets, skills, toggleToolset, toggleSkill]);

	if (route === "model") {
		return (
			<ModelChoice
				feature="language"
				current={config}
				onSelect={(model) => {
					setModel(model);
					setRoute(null);
				}}
				onClear={() => {
					updateSubagentConfig(null);
					setRoute(null);
				}}
			/>
		);
	}

	const listArg = modelArgs.find(
		(arg) => arg.type === "list" && route === `arg:${arg.name}`,
	);
	if (listArg?.type === "list") {
		const current = args[listArg.name] ?? listArg.default;
		return (
			<Choice
				groups={[
					{
						items: listArg.values.map((value) => ({
							name: value,
							value,
							active: value === current,
						})),
					},
				]}
				onSelect={(item) => {
					setModelArg(listArg.name, item.value);
					setRoute(null);
				}}
			/>
		);
	}

	const item = groups.flatMap((group) => group.items)[selected];

	return (
		<Completions<CompletionGroup<ConfigItem>, ConfigItem>
			groups={groups}
			selected={selected}
			setSelected={setSelected}
			selectFirstOnChange={false}
			onInput={({ item, key, input }) => {
				if (!item) return;
				if ((key.return || input === " ") && !item.disabled) {
					item.onSelect?.();
					return true;
				}
				const arg = item.arg;
				if (arg?.type === "range" && (key.leftArrow || key.rightArrow)) {
					const step = (arg.max - arg.min) / 50;
					const value = Number(args[arg.name] ?? arg.default);
					const next = value + (key.rightArrow ? step : -step);
					setModelArg(
						arg.name,
						Math.min(arg.max, Math.max(arg.min, Number(next.toPrecision(6)))),
					);
					return true;
				}
			}}
			renderItem={({ item }) =>
				item.enabled === undefined ? (
					<Text>
						{item.name}
						{"  "}
						<Text color="textSubtle">{item.state ?? chalk.dim("(none)")}</Text>
					</Text>
				) : (
					<Text dimColor={item.disabled ? true : undefined}>
						{chalk.dim("[")}
						<Text color="primary">{item.enabled ? "x" : " "}</Text>
						{chalk.dim("]")} {item.name}
					</Text>
				)
			}
			actions={[
				{
					key: "enter",
					name: item?.enabled === undefined ? "open" : "toggle",
					when: !!item?.onSelect,
				},
				{ key: "←→", name: "adjust", when: item?.arg?.type === "range" },
				"back",
			]}
		/>
	);
}
