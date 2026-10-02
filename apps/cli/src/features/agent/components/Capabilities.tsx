import { useBrowser } from "@tiny-chat/client/features/agent/hooks/useBrowser.ts";
import { useConfig } from "@tiny-chat/client/features/agent/hooks/useConfig.ts";
import { useSkills } from "@tiny-chat/client/features/agent/hooks/useSkills.ts";
import { useTools } from "@tiny-chat/client/features/agent/hooks/useTools.ts";
import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/features/editor/types/completion.ts";
import { CommonUtils } from "@tiny-chat/core/core/utils/CommonUtils.ts";
import { DataUtils } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import type { zSkill } from "@tiny-chat/core/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/features/tool/types/tool.ts";
import { ToolUtils } from "@tiny-chat/core/features/tool/utils/ToolUtils.ts";
import chalk from "chalk";
import { useCallback, useMemo, useState } from "react";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import type { Page } from "../../../core/stores/useAppStore.ts";
import Completions from "../../editor/components/Completions.tsx";
import SubagentConfig from "./SubagentConfig.tsx";

interface CapabilityGroup extends CompletionGroup<CapabilityItem> {}

interface CapabilityItem extends CompletionItem {
	detail?: string;
	/** A checkbox; without one, `found` marks a requirement as met or not. */
	enabled?: boolean;
	found?: boolean;
	disabled?: boolean;
	error?: unknown;
	toggle?: () => void;
	/** A page of its own settings, opened by key press. */
	opens?: Page;
}

const BROWSER_TOOLSET = "browser";

/** Toolsets with a page of their own settings, opened from the tools page. */
const TOOLSET_PAGES: Partial<Record<string, Page>> = {
	[BROWSER_TOOLSET]: "browser",
	subagents: "subagents",
};

export default function Capabilities() {
	const { config, setConfig } = useConfig();
	const { nativeTools, mcpTools } = useTools();
	const { nativeSkills, localSkills } = useSkills();
	const { browserStatus, browserSettings, recheckBrowser, setBrowserSettings } =
		useBrowser();

	// A toolset's page opens from it, so it goes back there; the subagent
	// page has pages of its own, and goes back itself.
	const { page, setPage } = usePage({
		onBack: () => {
			if (page === "subagents") return false;
			return page === "browser" ? "tools" : undefined;
		},
	});
	// Kept per page, so coming back from a toolset's page lands on it again.
	const [selection, setSelection] = useState<Partial<Record<Page, number>>>({});
	const selected = selection[page] ?? 0;
	const setSelected = useCallback(
		(update: (previous?: number) => number) =>
			setSelection((previous) => ({
				...previous,
				[page]: update(previous[page]),
			})),
		[page],
	);

	useWorkingStatus(
		nativeTools,
		mcpTools,
		nativeSkills,
		localSkills,
		browserStatus,
		recheckBrowser,
	);

	const groups = useMemo((): CapabilityGroup[] => {
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
						opens: page === "tools" ? TOOLSET_PAGES[name] : undefined,
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

		if (page === "tools") {
			return [
				buildToolsets("Native", nativeTools.data ?? []),
				buildToolsets("MCP", mcpTools.data ?? []),
			];
		} else if (page === "browser") {
			const status = recheckBrowser.data ?? browserStatus.data;
			const headed = browserSettings.data?.headed ?? false;
			const toolsets = buildToolsets(
				"Toolset",
				(nativeTools.data ?? []).filter(
					(toolset) => ToolUtils.name({ toolset }) === BROWSER_TOOLSET,
				),
			);
			return [
				toolsets,
				{
					name: "Requirements",
					items: status
						? [
								{
									name: "Node.js",
									value: "node",
									found: !!status.node,
									detail: status.node
										? `${status.node.version} · ${status.node.path}`
										: "not found",
								},
								{
									name: "Playwright",
									value: "playwright",
									found: !!status.playwright,
									detail: status.playwright
										? `${status.playwright.name}@${status.playwright.version} · ${status.playwright.path}`
										: "not found · npm install -g playwright",
								},
								...(status.error
									? [
											{
												name: "unavailable",
												value: "error",
												found: false,
												error: status.error,
											},
										]
									: []),
							]
						: [],
				},
				{
					name: "Browsers",
					items: (status?.browsers ?? []).map((browser) => ({
						name: `${browser.name}${browser.version ? ` ${browser.version}` : ""}`,
						value: browser.path,
						found: true,
						detail: `${browser.source}${browser.path === status?.browser?.path ? " · in use" : ""} · ${browser.path}`,
					})),
				},
				{
					name: "Settings",
					items: [
						{
							name: "show the browser window",
							value: "headed",
							enabled: headed,
							toggle: () => setBrowserSettings.mutate({ headed: !headed }),
						},
					],
				},
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
		browserStatus.data,
		browserSettings.data,
		recheckBrowser.data,
		setBrowserSettings,
	]);

	if (page === "subagents") return <SubagentConfig />;

	const opens = groups.flatMap((group) => group.items)[selected]?.opens;

	return (
		<Completions<CapabilityGroup, CapabilityItem>
			key={page}
			groups={groups}
			selected={selected}
			setSelected={setSelected}
			selectFirstOnChange={false}
			renderItem={({ item }) => {
				return (
					<Text
						color={item.error ? "redBright" : undefined}
						dimColor={item.disabled ? true : undefined}
					>
						{item.enabled === undefined ? (
							<Text color={item.found ? "primary" : "redBright"}>
								{item.found ? " ✓ " : " ✗ "}
							</Text>
						) : (
							<>
								{chalk.dim("[")}
								<Text color="primary">{item.enabled ? "x" : " "}</Text>
								{chalk.dim("]")}
							</>
						)}
						{` `}
						{item.name}
						{item.opens ? chalk.dim(" ›") : ""}
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
					item.toggle?.();
				} else if (input === "o" && item?.opens) {
					setPage(item.opens);
				} else if (page === "browser" && input === "r") {
					recheckBrowser.mutate();
				}
			}}
			actions={[
				{ key: "enter", name: "toggle" },
				{ key: "o", name: "open", when: !!opens },
				{ key: "r", name: "recheck", when: page === "browser" },
				"back",
			]}
		/>
	);
}
