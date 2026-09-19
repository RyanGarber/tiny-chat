import {
	ActionIcon,
	Box,
	Card,
	Collapse,
	Group,
	Space,
	Stack,
	Text,
	TextInput,
	Tooltip,
} from "@mantine/core";
import {
	ArrowClockwiseIcon,
	CaretDownIcon,
	CaretRightIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useProviders } from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import { useProviderSettings } from "@tiny-chat/client/src/features/settings/hooks/useProviderSettings.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import { useState } from "react";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

function getSummary(provider: ProviderState<ProviderStatus>) {
	const status = provider.status;
	if ("models" in status) {
		const models = status.models as unknown[];
		return `${models.length} ${models.length === 1 ? "model" : "models"}`;
	}
	if ("features" in status) {
		const features = status.features as string[];
		return features.join(", ") || "No features";
	}
	if (!status.valid) return "Not connected";
	return "Connected";
}

function ProviderCard({
	provider,
}: {
	provider: ProviderState<ProviderStatus>;
}) {
	const { providerSettings, setProviderSetting } = useProviderSettings();
	const { updateProviders, isUpdating } = useProviders();

	const [expanded, setExpanded] = useState(false);

	const updating = isUpdating(provider.name);
	const disabled = setProviderSetting.isPending || updating;

	return (
		<Card withBorder padding={0}>
			<Box
				role="button"
				tabIndex={0}
				p="xs"
				w="100%"
				style={{ cursor: "pointer" }}
				onClick={() => setExpanded((value) => !value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						setExpanded((value) => !value);
					}
				}}
			>
				<Group wrap="nowrap" align="flex-start">
					<Box pt={2}>
						{expanded ? (
							<CaretDownIcon size={16} />
						) : (
							<CaretRightIcon size={16} />
						)}
					</Box>
					<Stack gap={5} miw={0} flex={1}>
						<Text size="xs">{provider.name}</Text>
						<Text size="xs" c="dimmed">
							{updating ? "Checking…" : getSummary(provider)}
						</Text>
						{!!provider.status.error && (
							<Group gap="xs" c="red" wrap="nowrap">
								<Box>
									<WarningCircleIcon size={14} />
								</Box>
								<Text size="xs">{provider.status.error}</Text>
							</Group>
						)}
					</Stack>
					<Tooltip label={`Check ${provider.name}`} position="left">
						<ActionIcon
							variant="transparent"
							c="dimmed"
							aria-label={`Check ${provider.name}`}
							loading={updating}
							disabled={disabled}
							onClick={(event) => {
								event.stopPropagation();
								updateProviders.mutate({ providers: [provider.name] });
							}}
						>
							<ArrowClockwiseIcon size={18} />
						</ActionIcon>
					</Tooltip>
				</Group>
			</Box>
			<Collapse expanded={expanded}>
				<Stack px="xs" pb="xs" gap="xs">
					{provider.settings.map((key) => {
						const saving =
							setProviderSetting.isPending &&
							setProviderSetting.variables.provider === provider.name &&
							setProviderSetting.variables.key === key;

						return (
							<TextInput
								key={provider.name + key}
								label={key}
								styles={StyleUtils.input}
								defaultValue={providerSettings?.[provider.name]?.[key] ?? ""}
								onKeyDown={(event) =>
									event.key === "Enter" &&
									(event.target as HTMLInputElement).blur()
								}
								onBlur={(event) => {
									if (
										event.target.value ===
										(providerSettings?.[provider.name]?.[key] ?? "")
									)
										return;
									setProviderSetting.mutate({
										provider: provider.name,
										key,
										value: event.target.value,
									});
								}}
								disabled={saving}
								readOnly={saving}
							/>
						);
					})}
				</Stack>
			</Collapse>
		</Card>
	);
}

function Providers({
	providers,
}: {
	providers: ProviderState<ProviderStatus>[];
}) {
	return (
		<Stack gap="xs">
			{providers
				.filter((provider) => provider.settings.length)
				.map((provider) => (
					<ProviderCard key={provider.name} provider={provider} />
				))}
		</Stack>
	);
}

export default function KeysSettings() {
	const { providers, updateProviders, isUpdating } = useProviders();

	const areProvidersUpdating = isUpdating();

	return (
		<Stack>
			<Group justify="space-between">
				<Box>
					<Text size="sm">Chat</Text>
					<Text size="xs" c="dimmed">
						Access chat and embedding models
					</Text>
				</Box>
				<Tooltip label="Check for new models" position="right">
					<ActionIcon
						variant="transparent"
						c="dimmed"
						onClick={() => updateProviders.mutate({})}
						loading={areProvidersUpdating}
						disabled={areProvidersUpdating}
					>
						<ArrowClockwiseIcon size={20} />
					</ActionIcon>
				</Tooltip>
			</Group>
			<Providers
				providers={
					providers.data?.filter((provider) => provider.type === "model") ?? []
				}
			/>
			<Space />
			<Box>
				<Text size="sm">Web</Text>
				<Text size="xs" c="dimmed">
					Enable web browsing for chat models
				</Text>
			</Box>
			<Providers
				providers={
					providers.data?.filter((provider) => provider.type === "web") ?? []
				}
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
					<Providers
						providers={
							providers.data?.filter(
								(provider) =>
									provider.type === "other" && provider.settings.length > 0,
							) ?? []
						}
					/>
				</>
			)}
		</Stack>
	);
}
