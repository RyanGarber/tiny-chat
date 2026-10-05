import { useConfigEditor } from "@tiny-chat/client/features/agent/hooks/useConfigEditor.ts";
import { useSkills } from "@tiny-chat/client/features/agent/hooks/useSkills.ts";
import { useTools } from "@tiny-chat/client/features/agent/hooks/useTools.ts";
import type { CompletionGroup } from "@tiny-chat/client/features/editor/types/completion.ts";
import { useModelSettings } from "@tiny-chat/client/features/settings/hooks/useModelSettings.ts";
import type { zConfig } from "@tiny-chat/core/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import type { zSkill } from "@tiny-chat/core/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/features/tool/types/tool.ts";
import { ToolUtils } from "@tiny-chat/core/features/tool/utils/ToolUtils.ts";
import { useCallback, useMemo, useState } from "react";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import type { Page } from "../../../core/stores/useAppStore.ts";
import Completions from "../../editor/components/Completions.tsx";
import Choice from "../../settings/components/Choice.tsx";
import ModelChoice from "../../settings/components/ModelChoice.tsx";
import BrowserSettings from "./BrowserSettings.tsx";
import ConfigItemText, { type ConfigItem } from "./ConfigItem.tsx";

const BROWSER_TOOLSET = "browser";
const SUBAGENTS_TOOLSET = "subagents";

/** What opens over the menu: a model or list arg's choice, or a toolset's page. */
type Route = "model" | `arg:${string}` | "browser" | "subagents";

/**
 * One menu for a config's model, model args, tools and skills — the chat's,
 * or one kept in settings such as the subagent's — with the pages of the
 * toolsets that have settings of their own opened from it.
 */
export default function ConfigEditor({
	config,
	setConfig,
	onClear,
	onBack,
	subagents = true,
}: {
	config: zConfig | null;
	setConfig: (config: zConfig) => void;
	/** Lets the model be unset, which is what clears the config. */
	onClear?: () => void;
	/** Leaving the menu itself, as `usePage` takes it; back to the chat by default. */
	onBack?: () => Page | boolean | undefined;
	/** Opens the subagent's own config from its toolset. */
	subagents?: boolean;
}) {
	const { modelArgs, setModel, setModelArg, toggleToolset, toggleSkill } =
		useConfigEditor({ config, setConfig });
	const { nativeTools, mcpTools } = useTools();
	const { nativeSkills, localSkills } = useSkills();
	const { subagentConfig, updateSubagentConfig } = useModelSettings();

	const [route, setRoute] = useState<Route | null>(null);
	// Kept here, so coming back from a page lands on the item it opened from.
	const [selected, setSelected] = useState(0);

	useWorkingStatus(nativeTools, mcpTools, nativeSkills, localSkills);

	// The subagent's config handles its own way back.
	usePage({
		active: route !== "subagents",
		onBack: () => {
			if (!route) return onBack?.();
			setRoute(null);
			return false;
		},
	});

	const args = useMemo(
		() => (config?.args ?? {}) as Record<string, unknown>,
		[config?.args],
	);

	const toolsetItem = useCallback(
		(toolset: Toolset<any>): ConfigItem => {
			const name = ToolUtils.name({ toolset });
			const page =
				name === BROWSER_TOOLSET
					? "browser"
					: name === SUBAGENTS_TOOLSET && subagents
						? "subagents"
						: undefined;
			return {
				name,
				value: `toolset:${name}`,
				detail: toolset.tools
					.map((tool) => ToolUtils.name({ toolset, tool }))
					.join(", "),
				enabled: config ? ToolUtils.checkOne({ toolset, config }) : false,
				disabled: !toolset.status.valid,
				error: toolset.status.error,
				onSelect: () => toggleToolset(name),
				onOpen: page && (() => setRoute(page)),
			};
		},
		[config, subagents, toggleToolset],
	);

	const groups = useMemo((): CompletionGroup<ConfigItem>[] => {
		const model: CompletionGroup<ConfigItem> = {
			name: "Model",
			items: [
				{
					name: "model",
					value: "model",
					state: config?.model ?? "",
					detail: config?.provider || undefined,
					onSelect: () => setRoute("model"),
				},
				...modelArgs.map(
					(arg): ConfigItem => ({
						name: arg.name,
						value: `arg:${arg.name}`,
						state: String(args[arg.name] ?? arg.default),
						arg,
						onSelect:
							arg.type === "list"
								? () => setRoute(`arg:${arg.name}`)
								: undefined,
					}),
				),
			],
		};
		if (!config) return [model];

		const tools = (name: string, toolsets: Toolset<any>[]) => ({
			name,
			items: toolsets.map(toolsetItem),
		});
		const skills = (name: string, skills: zSkill[]) => ({
			name,
			items: skills.map(
				(skill): ConfigItem => ({
					name: skill.name,
					value: `skill:${skill.path}`,
					detail: DataUtils.getTextCleaned({
						data: skill.description,
						maxLength: 60,
					}),
					enabled: config.skills.includes(skill.path),
					disabled: !skill.name,
					onSelect: () => toggleSkill(skill.path),
				}),
			),
		});

		return [
			model,
			tools("Native tools", nativeTools.data ?? []),
			tools("MCP tools", mcpTools.data ?? []),
			skills("Native skills", nativeSkills.data ?? []),
			skills("Local skills", localSkills.data ?? []),
		].filter((group) => group.items.length > 0);
	}, [
		config,
		args,
		modelArgs,
		nativeTools.data,
		mcpTools.data,
		nativeSkills.data,
		localSkills.data,
		toolsetItem,
		toggleSkill,
	]);

	if (route === "model") {
		return (
			<ModelChoice
				feature="language"
				current={config}
				onSelect={(model) => {
					setModel(model);
					setRoute(null);
				}}
				onClear={
					onClear &&
					(() => {
						onClear();
						setRoute(null);
					})
				}
			/>
		);
	}

	if (route === "browser") {
		const toolset = (nativeTools.data ?? []).find(
			(toolset) => ToolUtils.name({ toolset }) === BROWSER_TOOLSET,
		);
		return (
			<BrowserSettings
				toolset={toolset && { ...toolsetItem(toolset), onOpen: undefined }}
			/>
		);
	}

	if (route === "subagents") {
		return (
			<ConfigEditor
				config={subagentConfig}
				setConfig={updateSubagentConfig}
				onClear={() => updateSubagentConfig(null)}
				onBack={() => {
					setRoute(null);
					return false;
				}}
				subagents={false}
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
			before={
				!subagents && (
					<Text color="textSubtle">
						The model, tools and skills subagents run with
					</Text>
				)
			}
			renderItem={({ item }) => <ConfigItemText item={item} />}
			renderEmpty={() => "nothing here yet"}
			onInput={({ item, key, input }) => {
				if (!item) return;
				if ((key.return || input === " ") && !item.disabled) {
					item.onSelect?.();
					return true;
				}
				if (input === "o" && item.onOpen) {
					item.onOpen();
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
			actions={[
				{
					key: "enter",
					name: item?.enabled === undefined ? "change" : "toggle",
					when: !!item?.onSelect && !item.disabled,
				},
				{ key: "o", name: "open", when: !!item?.onOpen },
				{ key: "←→", name: "adjust", when: item?.arg?.type === "range" },
				"back",
			]}
		/>
	);
}
