import "./env.ts";

import { Command } from "@commander-js/extra-typings";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClientContext } from "@tiny-chat/client/src/client.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { createLogger } from "@tiny-chat/core/src/logger.ts";
import { render } from "ink";
import { InkPictureProvider } from "ink-picture";
import tauri from "../../tauri/tauri.conf.json" with { type: "json" };
import { client } from "./client.ts";
import App from "./core/components/App.tsx";

createLogger({
	logToDisk: true,
	silent: !CommonUtils.isTruthy(process.env.DEV),
});

const cli = new Command()
	.name("tiny-chat")
	.description("Tiny Chat in the terminal.")
	.version(tauri.version);

cli.action(() => {
	render(
		<QueryClientProvider client={client.queryClient}>
			<ClientContext value={client}>
				<InkPictureProvider>
					<App />
				</InkPictureProvider>
			</ClientContext>
		</QueryClientProvider>,
		{ exitOnCtrlC: false },
	);
});

export { cli };
