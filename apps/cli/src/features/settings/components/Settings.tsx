import { useProviders } from "@tiny-chat/client/features/agent/hooks/useProviders.ts";
import { useMessagingStore } from "@tiny-chat/client/features/chat/stores/useMessagingStore.ts";
import type { CompletionGroup } from "@tiny-chat/client/features/editor/types/completion.ts";
import { useEmbeddingSettings } from "@tiny-chat/client/features/settings/hooks/useEmbeddingSettings.ts";
import { useHiddenModels } from "@tiny-chat/client/features/settings/hooks/useHiddenModels.ts";
import { useInstructions } from "@tiny-chat/client/features/settings/hooks/useInstructions.ts";
import { useModelSettings } from "@tiny-chat/client/features/settings/hooks/useModelSettings.ts";
import { useProviderSettings } from "@tiny-chat/client/features/settings/hooks/useProviderSettings.ts";
import { useShellSettings } from "@tiny-chat/client/features/settings/hooks/useShellSettings.ts";
import { useThemes } from "@tiny-chat/client/features/settings/hooks/useThemes.ts";
import { ThemeUtils } from "@tiny-chat/core/core/utils/ThemeUtils.ts";
import { zConfig } from "@tiny-chat/core/features/data/types/message.ts";
import type {
	ModelProviderStatus,
	zModelFeature,
} from "@tiny-chat/core/features/provider/types/model.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/features/provider/types/provider.ts";
import chalk from "chalk";
import { useMemo, useState } from "react";
import { client } from "../../../client.ts";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";
import Choice, { type ChoiceItem } from "./Choice.tsx";
import TextList, { type Draft } from "./TextList.tsx";

export const _debug = false;

/** The budgets the memory can be filled up to, as the app's slider steps. */
const MEMORY_BUDGETS = Array.from({ length: 21 }, (_, i) => i * 500);

type Feature = Exclude<zModelFeature, "language:tools">;

interface RootItem {
	name: string;
	value: string;
	state?: string;
	route: string;
}

const onOff = (value: boolean) => (value ? "on" : "off");

const summarize = (provider: ProviderState<ProviderStatus>) => {
	const status = provider.status;
	if ("models" in status) {
		const count = (status.models as unknown[]).length;
		return `${count} ${count === 1 ? "model" : "models"}`;
	}
	if ("features" in status) {
		return (status.features as string[]).join(", ") || "no features";
	}
	return status.valid ? "connected" : "not connected";
};

export default function Settings() {
	const project = useMessagingStore((state) => state.project);
	const { providers, updateProviders, isUpdating } = useProviders();

	const { theme, setTheme, codeTheme, setCodeTheme } = useThemes();
	const {
		useProviderCache,
		setUseProviderCache,
		useBrowserModels,
		setUseBrowserModels,
		preferredWebProvider,
		setPreferredWebProvider,
		providerSettings,
		setProviderSetting,
	} = useProviderSettings();
	const { hiddenModels, setHiddenModels } = useHiddenModels();
	const { subagentConfig, setSubagentConfig, dreamConfig, setDreamConfig } =
		useModelSettings();
	const {
		embeddingConfig,
		setEmbeddingConfig,
		useEmbeddingSearch,
		setUseEmbeddingSearch,
	} = useEmbeddingSettings();
	const {
		instructions,
		addInstruction,
		editInstruction,
		removeInstruction,
		memoryBudget,
		setMemoryBudget,
	} = useInstructions({ project });
	const {
		commandWhitelist,
		addCommand,
		editCommand,
		removeCommand,
		folders,
		folderStatus,
		addFolder,
		removeFolder,
		setFolderWritable,
	} = useShellSettings({ project });

	useWorkingStatus(
		setTheme,
		setCodeTheme,
		setUseProviderCache,
		setUseBrowserModels,
		setPreferredWebProvider,
		setProviderSetting,
		setHiddenModels,
		setSubagentConfig,
		setDreamConfig,
		setEmbeddingConfig,
		setUseEmbeddingSearch,
		addInstruction,
		editInstruction,
		removeInstruction,
		setMemoryBudget,
		addCommand,
		editCommand,
		removeCommand,
		addFolder,
		removeFolder,
		setFolderWritable,
		updateProviders,
	);

	// The pages open, root first. A provider's page is named `keys:<name>`.
	const [path, setPath] = useState<string[]>([]);
	const route = path.at(-1) ?? null;
	const push = (next: string) => setPath((current) => [...current, next]);
	const pop = () => setPath((current) => current.slice(0, -1));

	const [draft, setDraft] = useState<Draft | null>(null);
	const [pendingEmbedding, setPendingEmbedding] = useState<zConfig | null>(
		null,
	);

	usePage({
		onBack: () => {
			if (draft) {
				setDraft(null);
				return false;
			}
			if (path.length) {
				pop();
				return false;
			}
		},
	});

	const modelProviders = useMemo(
		() =>
			(providers.data ?? []).filter(
				(provider): provider is ProviderState<ModelProviderStatus> =>
					provider.type === "model",
			),
		[providers.data],
	);

	const [selected, setSelected] = useState(0);

	const root = useMemo<CompletionGroup<RootItem>[]>(() => {
		const groups: CompletionGroup<RootItem>[] = [
			{
				name: "appearance",
				items: [
					{ name: "theme", value: "theme", state: theme, route: "theme" },
					{
						name: "code theme",
						value: "code theme",
						state: codeTheme,
						route: "codeTheme",
					},
				],
			},
			{
				name: "performance",
				items: [
					{
						name: "provider cache",
						value: "provider cache",
						state: onOff(useProviderCache),
						route: "providerCache",
					},
					{
						name: "no native provider",
						value: "no native provider",
						state: onOff(!useBrowserModels),
						route: "browserModels",
					},
				],
			},
			{
				name: "preferred models",
				items: [
					{
						name: "generation",
						value: "generation",
						state: `${hiddenModels?.language?.length ?? 0} hidden`,
						route: "hiddenLanguage",
					},
					{
						name: "embedding",
						value: "embedding",
						state: `${hiddenModels?.embedding?.length ?? 0} hidden`,
						route: "hiddenEmbedding",
					},
				],
			},
			{
				name: "context",
				items: [
					{
						name: "instructions",
						value: "instructions",
						state: String(instructions?.length ?? 0),
						route: "instructions",
					},
					{
						name: "memory budget",
						value: "memory budget",
						state: String(memoryBudget),
						route: "memoryBudget",
					},
				],
			},
			{
				name: "shell",
				items: [
					...(client.desktop
						? [
								{
									name: "folders",
									value: "folders",
									state: String(folders.length),
									route: "folders",
								},
							]
						: []),
					{
						name: "commands",
						value: "commands",
						state: String(commandWhitelist.length),
						route: "commands",
					},
				],
			},
			{
				name: "retrieval",
				items: [
					{
						name: "embedding model",
						value: "embedding model",
						state: embeddingConfig?.model,
						route: "embeddingConfig",
					},
					{
						name: "smart search",
						value: "smart search",
						state: onOff(useEmbeddingSearch),
						route: "smartSearch",
					},
				],
			},
			{
				name: "agents",
				items: [
					{
						name: "dreaming model",
						value: "dreaming model",
						state: dreamConfig?.model,
						route: "dreamConfig",
					},
					{
						name: "subagent model",
						value: "subagent model",
						state: subagentConfig?.model,
						route: "subagentConfig",
					},
				],
			},
			{
				name: "web",
				items: [
					{
						name: "preferred provider",
						value: "preferred provider",
						state: preferredWebProvider ?? undefined,
						route: "webProvider",
					},
				],
			},
			{
				name: "keys",
				items: [{ name: "providers", value: "providers", route: "keys" }],
			},
		];
		return groups;
	}, [
		theme,
		codeTheme,
		useProviderCache,
		useBrowserModels,
		hiddenModels,
		instructions,
		memoryBudget,
		folders,
		commandWhitelist,
		embeddingConfig,
		useEmbeddingSearch,
		dreamConfig,
		subagentConfig,
		preferredWebProvider,
	]);

	/** A choice between plain values, the one in effect marked. */
	const choose = (
		values: readonly string[],
		current: string | undefined,
		set: (value: string) => void,
	) => (
		<Choice
			groups={[
				{
					items: values.map((value) => ({
						name: value,
						value,
						active: value === current,
					})),
				},
			]}
			onSelect={(item) => {
				set(item.value);
				pop();
			}}
		/>
	);

	/** A choice of one model that can do `feature`, picked from the valid providers. */
	const chooseModel = (
		feature: Feature,
		current: zConfig | null | undefined,
		set: (config: zConfig | null) => void,
	) => (
		<Choice<ChoiceItem & { config: Pick<zConfig, "provider" | "model"> }>
			groups={modelProviders
				.filter((provider) => provider.status.valid)
				.map((provider) => ({
					name: provider.name,
					items: provider.status.models
						.filter((model) => model.features.includes(feature))
						.map((model) => ({
							name: model.name,
							value: `${provider.name}/${model.name}`,
							config: { provider: provider.name, model: model.name },
							active:
								current?.provider === provider.name &&
								current.model === model.name,
						})),
				}))}
			onSelect={({ config }) =>
				set(
					zConfig.parse({
						...config,
						toolsets: current?.toolsets,
						skills: current?.skills,
					}),
				)
			}
			onClear={() => set(null)}
		/>
	);

	/** Which models of `feature` are shown, each toggled where it is listed. */
	const chooseVisible = (feature: "language" | "embedding") => {
		const hidden = hiddenModels?.[feature] ?? [];
		const isHidden = (provider: string, model: string) =>
			hidden.some((h) => h.provider === provider && h.model === model);
		return (
			<Choice<ChoiceItem & { config: Pick<zConfig, "provider" | "model"> }>
				groups={[...modelProviders]
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((provider) => ({
						name: provider.name,
						items: provider.status.models
							.filter((model) => model.features.includes(feature))
							.sort((a, b) => a.name.localeCompare(b.name))
							.map((model) => ({
								name: model.name,
								value: `${provider.name}/${model.name}`,
								config: { provider: provider.name, model: model.name },
								// Dimmed by the list, so it is the hidden ones that are.
								active: isHidden(provider.name, model.name),
							})),
					}))
					.filter((group) => group.items.length)}
				onSelect={({ config }) =>
					setHiddenModels.mutate({
						feature,
						models: isHidden(config.provider, config.model)
							? hidden.filter(
									(h) =>
										!(
											h.provider === config.provider && h.model === config.model
										),
								)
							: [...hidden, zConfig.parse(config)],
					})
				}
				renderItem={(item) => (
					<>
						<Text>{item.name}</Text>
						<Text>{item.active ? "hidden" : "shown"}</Text>
					</>
				)}
				actions={[]}
			/>
		);
	};

	if (route === "theme") {
		return choose(ThemeUtils.themes, theme, (value) =>
			setTheme.mutate({ theme: value as typeof theme }),
		);
	}
	if (route === "codeTheme") {
		return choose(ThemeUtils.codeThemesByTheme[theme], codeTheme, (value) =>
			setCodeTheme.mutate({ codeTheme: value as typeof codeTheme }),
		);
	}
	if (route === "providerCache") {
		return choose(["on", "off"], onOff(useProviderCache), (value) =>
			setUseProviderCache.mutate({ useProviderCache: value === "on" }),
		);
	}
	if (route === "browserModels") {
		return choose(["on", "off"], onOff(!useBrowserModels), (value) =>
			setUseBrowserModels.mutate({ useBrowserModels: value !== "on" }),
		);
	}
	if (route === "smartSearch") {
		return choose(["on", "off"], onOff(useEmbeddingSearch), (value) => {
			if (!embeddingConfig) return;
			setUseEmbeddingSearch.mutate({ useEmbeddingSearch: value === "on" });
		});
	}
	if (route === "memoryBudget") {
		return choose(MEMORY_BUDGETS.map(String), String(memoryBudget), (value) =>
			setMemoryBudget.mutate({ project, tokens: Number(value) }),
		);
	}
	if (route === "webProvider") {
		return choose(
			(providers.data ?? [])
				.filter((provider) => provider.type === "web" && provider.status.valid)
				.map((provider) => provider.name),
			preferredWebProvider ?? undefined,
			(value) =>
				setPreferredWebProvider.mutate({ preferredWebProvider: value }),
		);
	}
	if (route === "hiddenLanguage") return chooseVisible("language");
	if (route === "hiddenEmbedding") return chooseVisible("embedding");

	if (route === "subagentConfig") {
		return chooseModel("language", subagentConfig, (config) => {
			setSubagentConfig.mutate({ config });
			pop();
		});
	}
	if (route === "dreamConfig") {
		return chooseModel("language", dreamConfig, (config) => {
			setDreamConfig.mutate({ config });
			pop();
		});
	}
	if (route === "embeddingConfig") {
		return chooseModel("embedding", embeddingConfig, (config) => {
			// Every embedding is made again, so this is asked about first.
			setPendingEmbedding(config);
			setPath((current) => [...current.slice(0, -1), "embeddingConfirm"]);
		});
	}
	if (route === "embeddingConfirm") {
		return (
			<Choice
				groups={[
					{
						items: [
							{ name: "confirm", value: "confirm" },
							{ name: "cancel", value: "cancel" },
						],
					},
				]}
				before={
					<Text color="textSubtle">
						{pendingEmbedding
							? `All embeddings will be regenerated using the model ${pendingEmbedding.model}.`
							: "Features like memory and smart search will not be available."}
					</Text>
				}
				onSelect={(item) => {
					if (item.value === "confirm") {
						setEmbeddingConfig.mutate({ config: pendingEmbedding });
					}
					setPendingEmbedding(null);
					pop();
				}}
			/>
		);
	}

	if (route === "instructions") {
		return (
			<TextList
				entries={(instructions ?? []).map((text) => ({ text }))}
				draft={draft}
				setDraft={setDraft}
				placeholder="Keep responses short."
				onAdd={(instruction) => addInstruction.mutate({ project, instruction })}
				onEdit={(index, instruction) =>
					editInstruction.mutate({ project, index, instruction })
				}
				onRemove={(index) => removeInstruction.mutate({ project, index })}
			/>
		);
	}
	if (route === "commands") {
		return (
			<TextList
				entries={commandWhitelist.map((text) => ({ text }))}
				draft={draft}
				setDraft={setDraft}
				placeholder="npm run * (use * to match anything)"
				onAdd={(command) => addCommand.mutate({ project, command })}
				onEdit={(index, command) =>
					editCommand.mutate({ project, index, command })
				}
				onRemove={(index) => removeCommand.mutate({ project, index })}
			/>
		);
	}
	if (route === "folders") {
		return (
			<TextList
				entries={folders.map(({ path, writable }) => ({
					text: path,
					detail: [
						writable ? "skips approval for edits" : "asks before edits",
						folderStatus.data?.[path] === false ? "unavailable" : undefined,
					]
						.filter(Boolean)
						.join(" · "),
					error: folderStatus.data?.[path] === false,
				}))}
				draft={draft}
				setDraft={setDraft}
				placeholder="add folder"
				onAdd={(path) => addFolder.mutate({ project, path })}
				onSelect={(index) =>
					setFolderWritable.mutate({
						project,
						index,
						writable: !folders[index].writable,
					})
				}
				onRemove={(index) => removeFolder.mutate({ project, index })}
				actions={[{ key: "enter", name: "toggle edit approval" }]}
			/>
		);
	}

	if (route === "keys") {
		const keyed = (providers.data ?? []).filter(
			(provider) => provider.settings.length,
		);
		return (
			<Choice<ChoiceItem & { provider: string }>
				groups={(["model", "web", "other"] as const)
					.map((type) => ({
						name: type,
						items: keyed
							.filter((provider) => provider.type === type)
							.map((provider) => ({
								name: provider.name,
								value: provider.name,
								provider: provider.name,
								detail: isUpdating(provider.name)
									? "checking..."
									: summarize(provider),
							})),
					}))
					.filter((group) => group.items.length)}
				onSelect={({ provider }) => push(`keys:${provider}`)}
				onKey={({ input }) => {
					if (input !== "r") return;
					updateProviders.mutate({});
					return true;
				}}
				renderItem={(item) => (
					<>
						<Text>{item.name}</Text>
						<Text color="textSubtle">{item.detail}</Text>
					</>
				)}
				actions={[{ key: "r", name: "check all" }]}
			/>
		);
	}
	if (route?.startsWith("keys:")) {
		const name = route.slice("keys:".length);
		const provider = providers.data?.find((p) => p.name === name);
		if (!provider) return null;
		return (
			<TextList
				entries={provider.settings.map((key) => ({
					label: key,
					text: providerSettings?.[name]?.[key] ?? "",
				}))}
				draft={draft}
				setDraft={setDraft}
				placeholder="value"
				mask
				onEdit={(index, value) =>
					setProviderSetting.mutate({
						provider: name,
						key: provider.settings[index],
						value,
					})
				}
				onKey={({ input }) => {
					if (input !== "r") return;
					updateProviders.mutate({ providers: [name] });
					return true;
				}}
				actions={[{ key: "r", name: "check" }]}
			/>
		);
	}

	return (
		<Completions<CompletionGroup<RootItem>, RootItem>
			groups={root}
			selected={selected}
			setSelected={setSelected}
			selectFirstOnChange={false}
			itemProps={{
				flexGrow: 1,
				flexShrink: 1,
				maxWidth: 50,
				justifyContent: "space-between",
			}}
			onInput={({ item, key }) => {
				if (item && key.return) {
					push(item.route);
					return true;
				}
			}}
			renderItem={({ item }) => (
				<>
					<Text>{item.name}</Text>
					<Text color="text">{item.state ?? chalk.dim("(none)")}</Text>
				</>
			)}
			actions={[{ key: "enter", name: "open" }, "back"]}
		/>
	);
}
