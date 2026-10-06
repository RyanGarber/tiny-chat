import {
	Box,
	CheckboxCard,
	CheckboxIndicator,
	Group,
	Select,
	Space,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import { useHiddenModels } from "#client/features/settings/hooks/useHiddenModels.ts";
import { useProviderSettings } from "#client/features/settings/hooks/useProviderSettings.ts";
import { useThemes } from "#client/features/settings/hooks/useThemes.ts";
import { ThemeUtils } from "#core/core/utils/ThemeUtils.ts";
import { zConfig } from "#core/features/data/types/message.ts";
import { ModelMultiSelect } from "#gui/core/components/ModelSelect.tsx";
import { StyleUtils } from "#gui/core/utils/StyleUtils.ts";

export default function AppSettings() {
	const { theme, setTheme, codeTheme, setCodeTheme } = useThemes();
	const {
		useProviderCache,
		setUseProviderCache,
		useBrowserModels,
		setUseBrowserModels,
	} = useProviderSettings();
	const { hiddenModels, setHiddenModels } = useHiddenModels();

	return (
		<Stack>
			<Box>
				<Text size="sm">Appearance</Text>
				<Text size="xs" c="dimmed">
					Changes the look of the app
				</Text>
			</Box>
			<Tooltip label="Styles the app" position="right">
				<Select
					label="App Theme"
					styles={StyleUtils.input}
					allowDeselect={false}
					data={ThemeUtils.themes}
					value={theme}
					onChange={(value) => {
						if (!value) return;
						setTheme.mutate({ theme: value });
					}}
					disabled={setTheme.isPending}
					readOnly={setTheme.isPending}
				></Select>
			</Tooltip>
			<Tooltip label="Styles code blocks" position="right">
				<Select
					label="Code Theme"
					styles={StyleUtils.input}
					allowDeselect={false}
					data={ThemeUtils.codeThemesByTheme[theme]}
					value={codeTheme}
					onChange={(value) => {
						if (!value) return;
						setCodeTheme.mutate({ codeTheme: value });
					}}
					disabled={setCodeTheme.isPending}
					readOnly={setCodeTheme.isPending}
				/>
			</Tooltip>
			<Space />
			<Box>
				<Text size="sm">Performance</Text>
				<Text size="xs" c="dimmed">
					Optimizes performance of the app
				</Text>
			</Box>
			<Tooltip label="Reuse model lists for faster loading" position="right">
				<CheckboxCard
					p="xs"
					checked={useProviderCache}
					onChange={(value) => {
						setUseProviderCache.mutate({ useProviderCache: value });
					}}
				>
					<Group>
						<CheckboxIndicator size="xs" />
						<Text size="sm">Provider Cache</Text>
					</Group>
				</CheckboxCard>
			</Tooltip>
			<Tooltip
				label="Disable WebLLM support for faster loading"
				position="right"
			>
				<CheckboxCard
					p="xs"
					checked={!useBrowserModels}
					onChange={(value) =>
						setUseBrowserModels.mutate({ useBrowserModels: !value })
					}
				>
					<Group>
						<CheckboxIndicator size="xs" />
						<Text size="sm">No Native Provider</Text>
					</Group>
				</CheckboxCard>
			</Tooltip>
			<Space />
			<Box>
				<Text size="sm">Preferred Models</Text>
				<Text size="xs" c="dimmed">
					Determines the models shown in the app
				</Text>
			</Box>
			<Stack>
				<Tooltip label="Generative models to show" position="right">
					<ModelMultiSelect
						label="Generation"
						styles={StyleUtils.input}
						feature="language"
						configValues={
							hiddenModels?.language?.map((m) => zConfig.parse(m)) ?? []
						}
						onConfigChange={(value) =>
							setHiddenModels.mutate({
								feature: "language",
								models: value,
							})
						}
						includeHidden
						invert
					/>
				</Tooltip>
				<Tooltip label="Embedding models to show" position="right">
					<ModelMultiSelect
						label="Embedding"
						styles={StyleUtils.input}
						feature="embedding"
						configValues={
							hiddenModels?.embedding?.map((m) => zConfig.parse(m)) ?? []
						}
						onConfigChange={(value) =>
							setHiddenModels.mutate({
								feature: "embedding",
								models: value,
							})
						}
						includeHidden
						invert
					/>
				</Tooltip>
			</Stack>
		</Stack>
	);
}
