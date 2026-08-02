import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useProviders } from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import type { ModelProviderStatus } from "@tiny-chat/core/src/features/provider/types/model.ts";
import { Box, Text, useInput, useWindowSize } from "ink";
import { ScrollList } from "ink-scroll-list";
import { useMemo, useState } from "react";
import { useLoadingStatus } from "../../../core/hooks/useLoadingStatus.ts";
import { useAppStore } from "../../../core/stores/useAppStore.ts";

export default function ModelList() {
	const { rows } = useWindowSize();

	const { providers } = useProviders();
	const { config, setConfig } = useConfig();
	useLoadingStatus(providers);

	const models = useMemo(() => {
		return (
			providers.data?.flatMap((provider) =>
				provider.type === "model" && provider.status.valid
					? (provider.status as ModelProviderStatus).models
					: [],
			) ?? []
		);
	}, [providers.data]);

	const setPage = useAppStore((state) => state.setPage);

	const [selected, setSelected] = useState(0);

	useInput((_, key) => {
		if (key.upArrow) {
			setSelected((previous) => Math.max(previous - 1, 0));
		}
		if (key.downArrow) {
			setSelected((previous) => Math.min(previous + 1, models.length - 1));
		}
		if (key.return) {
			const provider = providers.data?.find(
				(provider) =>
					provider.type === "model" &&
					(provider.status as ModelProviderStatus).models.includes(
						models[selected],
					),
			);
			if (!provider) return;
			setConfig({
				provider: provider.name,
				model: models[selected].name,
				args: {},
				skills: config.skills,
				toolsets: config.toolsets,
			});
			setPage("chat");
		}
	});

	return (
		<ScrollList
			selectedIndex={selected}
			height={rows - 2}
			borderColor="blueBright"
			borderStyle="round"
		>
			{models.map((model) => {
				const provider = providers.data?.find(
					(provider) =>
						provider.type === "model" &&
						(provider.status as ModelProviderStatus).models.includes(model),
				);
				const isFirstModel =
					provider &&
					(provider.status as ModelProviderStatus).models.indexOf(model) === 0;
				return (
					<Box key={model.name} flexDirection="column">
						{isFirstModel && <Text color="gray">--- {provider?.name} ---</Text>}
						<Text color={selected === models.indexOf(model) ? "blue" : "white"}>
							{selected === models.indexOf(model) ? "▶ " : "  "}
							{model.name}
						</Text>
					</Box>
				);
			})}
		</ScrollList>
	);
}
