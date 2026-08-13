import "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClientContext } from "@tiny-chat/client/src/client.ts";
import ThemeContextProvider from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import chalk from "chalk";
import { Box, render, Text, useWindowSize } from "ink";
import { client } from "./client.ts";
import { Code } from "./features/code/components/Code.tsx";
import Diff from "./features/code/components/Diff.tsx";
import Task from "./features/part/components/Task.tsx";

render(
	<QueryClientProvider client={client.queryClient}>
		<ClientContext value={client}>
			<ThemeContextProvider>
				<App />
			</ThemeContextProvider>
		</ClientContext>
	</QueryClientProvider>,
);

function App() {
	const { rows, columns } = useWindowSize();

	return (
		<Box
			width={columns}
			height={rows}
			flexDirection="column"
			gap={1}
			justifyContent="space-evenly"
			overflow="hidden"
			backgroundColor="#333333"
		>
			<Text bold underline>
				Task Test
			</Text>
			<Task.Group detailsProps={{ backgroundColor: "#222222", paddingY: 1 }}>
				<Task>
					<Task.Status
						status="success"
						emoji={"🪨"}
						parts={[{ text: "Thought" }]}
					/>
					<Task.Details>
						<Text>Time to get this wrong cause I'm a stupid AI.</Text>
					</Task.Details>
				</Task>
				<Task>
					<Task.Status
						status="error"
						emoji={"🔧"}
						parts={[
							{ text: "Read file" },
							{ text: "file.html", style: chalk.bold },
						]}
					/>
					<Task.Details>
						<Text bold>/Users/ryan/file.html</Text>
						<Text dimColor>
							ENOENT: no such file or directory: /Users/ryan/file.html
						</Text>
					</Task.Details>
					<Task.Details collapse={false}>
						<Text>^ The file's here actually: ~/file.txt</Text>
					</Task.Details>
				</Task>
				<Task>
					<Task.Status
						status="success"
						emoji={"🔧"}
						parts={[
							{ text: "Read file" },
							{ text: "file.txt", style: chalk.bold },
						]}
					/>
					<Task.Details>
						<Text bold>/Users/ryan/file.txt</Text>
						<Code
							code={`const a = 1;\na = a + 1;\nconsole.log(a);`}
							language="ts"
						/>
					</Task.Details>
				</Task>
				<Task>
					<Task.Status
						status="pending"
						emoji={"🔧"}
						parts={[
							{ text: "Editing file" },
							{ text: "file.txt", style: chalk.bold },
						]}
					/>
					<Task.Details>
						<Text bold>/Users/ryan/file.txt</Text>
						<Diff
							before={`const a = 1;\na = a + 1;\nconsole.log(a);`}
							after={`let a = 1;\na = a + 1;\nconsole.log(a);`}
							language="ts"
						/>
					</Task.Details>
				</Task>
			</Task.Group>
			<Text>---</Text>
		</Box>
	);
}
