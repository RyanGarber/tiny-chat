import {
	type DefaultMantineColor,
	Group,
	Loader,
	RingProgress,
	Stack,
	Text,
} from "@mantine/core";
import { useEstimatedTokens } from "@tiny-chat/client/src/features/editor/hooks/useEstimatedTokens.ts";
import Popup from "#app/core/components/Popup.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { useEditorStore } from "#app/features/editor/stores/useEditorStore.ts";

export default function TokenUsage() {
	const data = useEditorStore((state) => state.data);

	const { totalUsage, categories } = useEstimatedTokens<DefaultMantineColor>({
		data,
		colors: { low: "blue", moderate: "orange", high: "red" },
	});

	return (
		<Popup position="top">
			<Popup.Target>
				{totalUsage.loading ? (
					<Loader size="xs" />
				) : (
					<RingProgress
						size={24}
						thickness={3}
						roundCaps
						sections={[
							{
								value: totalUsage.percent,
								color: totalUsage.color,
							},
						]}
					/>
				)}
			</Popup.Target>
			<Popup.Dropdown
				style={{ ...StyleUtils.glass, boxShadow: StyleUtils.shadow }}
				c="var(--mantine-color-text)"
			>
				<Stack gap="xs">
					{categories.map((category) => (
						<Group key={category.name} justify="space-between">
							<Text size="sm">{category.name}: </Text>
							<Text size="sm">
								{category.loading ? (
									<Loader size="xs" />
								) : (
									Math.round(category.tokens).toLocaleString()
								)}
							</Text>
						</Group>
					))}
				</Stack>
			</Popup.Dropdown>
		</Popup>
	);
}
