import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Box,
	Group,
	Space,
	Stack,
	Text,
	TextInput,
	Tooltip,
} from "@mantine/core";
import { useIsMutating } from "@tanstack/react-query";
import {
	providerCacheMutationKey,
	useProviders,
} from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import { useProviderSettings } from "@tiny-chat/client/src/features/settings/hooks/useProviderSettings.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

function Provider({
	providers,
	providerSettings,
}: {
	providers: ProviderState<ProviderStatus>[];
	providerSettings: ReturnType<typeof useProviderSettings>["providerSettings"];
}) {
	const { setProviderSetting } = useProviderSettings();

	return (
		<Stack>
			{providers
				.filter((s) => s.settings.length)
				.map((provider) => (
					<Box
						key={provider.name}
						style={
							!provider.status.valid
								? {
										border: "1px solid var(--mantine-color-red-6)",
										borderRadius: "var(--mantine-radius-md)",
										padding: "var(--mantine-spacing-xs)",
									}
								: undefined
						}
					>
						<Group justify="space-between">
							<Text size="sm">{provider.name}</Text>
							{provider.status?.error && (
								<Text size="xs" c="red">
									{provider.status.error}
								</Text>
							)}
						</Group>
						<Stack mt={5}>
							{provider.settings.map((s) => (
								<TextInput
									key={provider.name + s}
									label={s}
									styles={StyleUtils.input}
									defaultValue={providerSettings?.[provider.name]?.[s] ?? ""}
									onKeyDown={(e) =>
										e.key === "Enter" && (e.target as HTMLInputElement).blur()
									}
									onBlur={(e) => {
										if (
											e.target.value ===
											(providerSettings?.[provider.name]?.[s] ?? "")
										)
											return;
										setProviderSetting.mutate({
											provider: provider.name,
											key: s,
											value: e.target.value,
										});
									}}
									disabled={
										setProviderSetting.isPending &&
										setProviderSetting.variables.provider === provider.name &&
										setProviderSetting.variables.key === s
									}
									readOnly={
										setProviderSetting.isPending &&
										setProviderSetting.variables.provider === provider.name &&
										setProviderSetting.variables.key === s
									}
								/>
							))}
						</Stack>
					</Box>
				))}
		</Stack>
	);
}

export default function KeysSettings() {
	const { providers, updateProviders } = useProviders();
	const { providerSettings, setProviderSetting } = useProviderSettings();

	const areProvidersUpdating =
		useIsMutating({ mutationKey: providerCacheMutationKey }) > 0;

	return (
		<Stack>
			<Group justify="space-between">
				<Box>
					<Text size="sm">Chat</Text>
					<Text size="xs" c="dimmed">
						Access chat and embedding models
					</Text>
				</Box>
				<Tooltip label="Check for new models" color="gray" position="right">
					<ActionIcon
						variant="transparent"
						c="dimmed"
						onClick={() => updateProviders.mutate()}
						loading={setProviderSetting.isPending || areProvidersUpdating}
						disabled={setProviderSetting.isPending || areProvidersUpdating}
					>
						<Icon icon="lucide:refresh-cw" />
					</ActionIcon>
				</Tooltip>
			</Group>
			<Provider
				providers={
					providers.data?.filter((provider) => provider.type === "model") ?? []
				}
				providerSettings={providerSettings}
			/>
			<Space />
			<Box>
				<Text size="sm">Web</Text>
				<Text size="xs" c="dimmed">
					Enable web browsing for chat models
				</Text>
			</Box>
			<Provider
				providers={
					providers.data?.filter((provider) => provider.type === "web") ?? []
				}
				providerSettings={providerSettings}
			/>
			{(providers.data?.filter(
				(provider) => provider.type === "other" && provider.settings.length > 0,
			).length ?? 0) > 0 && (
				<>
					<Space />
					<Box>
						<Text size="sm">Other</Text>
						<Text size="xs" c="dimmed">
							Enable extra features and integrations
						</Text>
					</Box>
					<Provider
						providers={
							providers.data?.filter(
								(provider) =>
									provider.type === "other" && provider.settings.length > 0,
							) ?? []
						}
						providerSettings={providerSettings}
					/>
				</>
			)}
		</Stack>
	);
}
