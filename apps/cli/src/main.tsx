import "./env.ts";

import { Command } from "@commander-js/extra-typings";
import { QueryClientProvider } from "@tanstack/react-query";
import { createLogger } from "@tiny-chat/core/src/logger.ts";
import { render } from "ink";
import tauri from "../../tauri/tauri.conf.json" with { type: "json" };
import { client } from "./client.ts";
import App from "./core/components/App.tsx";

createLogger();

const cli = new Command()
	.name("tiny-chat")
	.description("Tiny Chat in the terminal.")
	.version(tauri.version);

cli.action(() => {
	render(
		<QueryClientProvider client={client.queryClient}>
			<App />
		</QueryClientProvider>,
	);
});

export { cli };
