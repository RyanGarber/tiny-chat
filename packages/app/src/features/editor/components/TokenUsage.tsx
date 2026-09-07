import {
	type DefaultMantineColor,
	Group,
	Loader,
	RingProgress,
	Stack,
	Text,
} from "@mantine/core";
import type {
	Categories,
	Usage,
} from "@tiny-chat/client/src/features/editor/hooks/useEstimatedTokens.ts";
import Popup from "#app/core/components/Popup.tsx";

export default function TokenUsage({
	usage,
	categories,
}: {
	usage: Usage<DefaultMantineColor>;
	categories: Categories;
}) {
	return (
		<Popup position="top">
			<Popup.Target>
				{usage.loading ? (
					<Loader size="xs" />
				) : (
					<RingProgress
						size={24}
						thickness={3}
						roundCaps
						sections={[
							{
								value: usage.percent,
								color: usage.color,
							},
						]}
					/>
				)}
			</Popup.Target>
			<Popup.Dropdown c="var(--mantine-color-text)">
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
