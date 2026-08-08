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
import { useHiddenModels } from "@tiny-chat/client/src/features/settings/hooks/useHiddenModels.ts";
import { useProviderSettings } from "@tiny-chat/client/src/features/settings/hooks/useProviderSettings.ts";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import { ModelMultiSelect } from "#app/core/components/ModelSelect.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

export default function AppSettings() {
	const { theme, setTheme, codeTheme, setCodeTheme, blackout, setBlackout } =
		useThemes();
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
			<Tooltip label="Styles the app" color="gray" position="right">
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
			<Tooltip label="Styles code blocks" color="gray" position="right">
				<Select
					label="Code Theme"
					styles={StyleUtils.input}
					allowDeselect={false}
					data={ThemeUtils.codeThemesByTheme(theme)}
					value={codeTheme}
					onChange={(value) => {
						if (!value) return;
						setCodeTheme.mutate({ codeTheme: value });
					}}
					disabled={setCodeTheme.isPending}
					readOnly={setCodeTheme.isPending}
				/>
			</Tooltip>
			<Tooltip
				label="Replaces color with grayscale"
				color="gray"
				position="right"
			>
				<CheckboxCard
					p="xs"
					checked={blackout}
					onChange={(value) => {
						setBlackout.mutate({ blackout: value });
					}}
				>
					<Group>
						<CheckboxIndicator size="xs" />
						<Text size="sm">Blackout</Text>
					</Group>
				</CheckboxCard>
			</Tooltip>
			<Space />
			<Box>
				<Text size="sm">Performance</Text>
				<Text size="xs" c="dimmed">
					Optimizes performance of the app
				</Text>
			</Box>
			<Tooltip
				label="Reuse model lists for faster loading"
				color="gray"
				position="right"
			>
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
				color="gray"
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
				<Tooltip
					label="Generative models to show"
					color="gray"
					position="right"
				>
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
				<Tooltip label="Embedding models to show" color="gray" position="right">
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
