import { Text } from "ink";

export default function HelpText({
	actions,
}: {
	actions: { key: string; name: string; when?: boolean }[];
}) {
	const active = actions.filter((action) => action.when ?? true);
	return (
		<Text>
			{active.map((action, index) => (
				<Text key={action.key + action.name}>
					<Text dimColor bold>
						{action.key}
					</Text>{" "}
					<Text dimColor>
						{action.name}
						{index !== active.length - 1 && " · "}
					</Text>
				</Text>
			))}
		</Text>
	);
}
