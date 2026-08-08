import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { ModelProviderStatus } from "@tiny-chat/core/src/features/provider/types/model.ts";
import type { ProviderState } from "@tiny-chat/core/src/features/provider/types/provider.ts";
import { useCallback, useContext, useRef } from "react";
import { ClientContext } from "../../../client.ts";
import { useConfig } from "../../agent/hooks/useConfig.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useSkills } from "../../agent/hooks/useSkills.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { usePresets } from "../../settings/hooks/usePresets.ts";
import type {
	CommandChoiceGroup,
	CommandGroup,
	CommandItem,
} from "../types/command.ts";

/**
 * Build the commands available to any client, optionally extended with
 * commands that only make sense for the host of the input.
 */
export const useCommands = ({
	commands = [],
	onOpenTools,
	onOpenSkills,
}: {
	commands?: CommandItem[];
	onOpenTools?: () => void;
	onOpenSkills?: () => void;
} = {}) => {
	const client = useContext(ClientContext);

	const { providers, updateProviders } = useProviders();
	const { skills, localSkills } = useSkills();
	const { mcpTools } = useTools();
	const { config, setConfig, modelArgs, setModelArg } = useConfig();
	const { presets, setPreset, unsetPreset } = usePresets();

	const clientRef = useRef(client);
	clientRef.current = client;

	const commandsRef = useRef(commands);
	commandsRef.current = commands;

	const onOpenToolsRef = useRef(onOpenTools);
	onOpenToolsRef.current = onOpenTools;
	const onOpenSkillsRef = useRef(onOpenSkills);
	onOpenSkillsRef.current = onOpenSkills;

	const providersRef = useRef(providers.data);
	providersRef.current = providers.data;
	const updateProvidersRef = useRef(updateProviders);
	updateProvidersRef.current = updateProviders;

	const configRef = useRef(config);
	configRef.current = config;
	const setConfigRef = useRef(setConfig);
	setConfigRef.current = setConfig;

	const modelArgsRef = useRef(modelArgs);
	modelArgsRef.current = modelArgs;
	const setModelArgRef = useRef(setModelArg);
	setModelArgRef.current = setModelArg;

	const presetsRef = useRef(presets);
	presetsRef.current = presets;
	const setPresetRef = useRef(setPreset);
	setPresetRef.current = setPreset;
	const unsetPresetRef = useRef(unsetPreset);
	unsetPresetRef.current = unsetPreset;

	const skillsRef = useRef(skills);
	skillsRef.current = skills;
	const localSkillsRef = useRef(localSkills);
	localSkillsRef.current = localSkills;

	const mcpToolsRef = useRef(mcpTools);
	mcpToolsRef.current = mcpTools;

	const getCommands = useCallback((): CommandGroup[] => {
		const models: CommandChoiceGroup[] =
			providersRef.current
				?.filter(
					(provider): provider is ProviderState<ModelProviderStatus> =>
						provider.type === "model",
				)
				.map((provider) => ({
					name: provider.name,
					items: provider.status.models.map((model) => ({
						name: model.name,
						value: model.name,
						active:
							configRef.current.provider === provider.name &&
							configRef.current.model === model.name,
						run: () => {
							console.log(
								"[useCommands] setting config:",
								{
									provider: provider.name,
									model: model.name,
									toolsets: configRef.current.toolsets,
									skills: configRef.current.skills,
								},
								zConfig.parse({
									provider: provider.name,
									model: model.name,
									toolsets: configRef.current.toolsets,
									skills: configRef.current.skills,
								}),
							);
							setConfigRef.current(
								zConfig.parse({
									provider: provider.name,
									model: model.name,
									toolsets: configRef.current.toolsets,
									skills: configRef.current.skills,
								}),
							);
						},
					})),
				})) ?? [];

		const modelArgs: CommandItem[] = modelArgsRef.current.flatMap((arg) => {
			if (arg.type === "list") {
				return {
					name: arg.name,
					value: arg.name,
					choices: [
						{
							items: arg.values.map((value) => ({
								name: value,
								value,
								active:
									configRef.current.args?.[arg.name] === value ||
									(!configRef.current.args?.[arg.name] &&
										arg.default === value),
								run: () => setModelArgRef.current(arg.name, value),
							})),
						},
					],
				};
			} else if (arg.type === "range") {
				return {
					name: arg.name,
					value: arg.name,
					dynamic: true,
					run: (value) => {
						if (!value) return;
						const int = Number(value);
						if (!Number.isInteger(int)) return;
						if (int < arg.min || int > arg.max) return;
						setModelArgRef.current(arg.name, int);
					},
				};
			}
			return [];
		});

		const presets: CommandChoiceGroup[] = [
			{
				items: Object.entries(presetsRef.current ?? {}).map(
					([name, preset]) => ({
						name,
						value: name,
						run: (command) => {
							if (command.name === "preset") {
								setConfigRef.current(preset);
							} else if (command.name === "unset-preset") {
								unsetPresetRef.current.mutate({
									name,
								});
							}
						},
					}),
				),
			},
		];

		const skills: CommandItem[] = skillsRef.current.map((skill) => ({
			name: skill.name,
			value: `skill:${skill.path}`,
		}));

		const shell: CommandItem[] = clientRef.current.shell?.chdir
			? [
					{
						name: "cd",
						value: "cd",
						dynamic: true,
						run: async (value) => {
							if (!value) return;
							await clientRef.current.shell?.chdir?.({ path: value });
						},
					},
				]
			: [];

		return [
			{
				name: "Commands",
				items: [
					...commandsRef.current,
					{ name: "model", value: "model", choices: models },
					...modelArgs,
					{
						name: "reload",
						value: "reload",
						run: () => {
							updateProvidersRef.current.mutate();
							void localSkillsRef.current.refetch();
							void mcpToolsRef.current.refetch();
						},
					},
					{
						name: "set-preset",
						value: "set-preset",
						dynamic: true,
						run: (value) => {
							if (!value) return;
							setPresetRef.current.mutate({
								name: value,
								config: configRef.current,
							});
						},
					},
					{
						name: "unset-preset",
						value: "unset-preset",
						choices: presets,
					},
					{
						name: "preset",
						value: "preset",
						choices: presets,
					},
					{ name: "system-prompt", value: "system-prompt", dynamic: true },
					{
						name: "tools",
						value: "tools",
						run: () => onOpenToolsRef.current?.(),
					},
					{
						name: "skills",
						value: "skills",
						run: () => onOpenSkillsRef.current?.(),
					},
					...shell,
				],
			},
			{
				name: "Skills",
				items: skills,
			},
		];
	}, []);

	return { getCommands };
};
