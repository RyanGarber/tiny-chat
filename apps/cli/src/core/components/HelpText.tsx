import Text from "./Text.tsx";

export type Action =
	| { key: string; name: string; when?: boolean }
	| "choose"
	| "select"
	| "back";

export default function HelpText({ actions: _actions }: { actions: Action[] }) {
	const actions = _actions.map((action) => {
		if (action === "choose") {
			return { key: "↑↓", name: "choose" };
		}
		if (action === "select") {
			return { key: "enter", name: "select" };
		}
		if (action === "back") {
			return { key: "esc", name: "back" };
		}
		return action;
	});

	const active = actions.filter((action) => action.when ?? true);

	return (
		<Text color="textSubtle">
			{active.map((action, index) => (
				<Text key={action.key + action.name}>
					<Text bold>{action.key}</Text>{" "}
					<Text>
						{action.name}
						{index !== active.length - 1 && " · "}
					</Text>
				</Text>
			))}
		</Text>
	);
}
