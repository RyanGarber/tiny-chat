import "./env.ts";

import { Command } from "@commander-js/extra-typings";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClientContext } from "@tiny-chat/client/src/client.ts";
import ThemeContextProvider from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { createLogger } from "@tiny-chat/core/src/logger.ts";
import { render } from "ink";
import { InkPictureProvider } from "ink-picture";
import tauri from "../../tauri/tauri.conf.json" with { type: "json" };
import { client } from "./client.ts";
import App from "./core/components/App.tsx";
import { StdinUtils } from "./core/utils/StdinUtils.ts";

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
				<ThemeContextProvider>
					<InkPictureProvider>
						<App />
					</InkPictureProvider>
				</ThemeContextProvider>
			</ClientContext>
		</QueryClientProvider>,
		{
			exitOnCtrlC: false,
			patchConsole: CommonUtils.isTruthy(process.env.DEV),
			stdin: StdinUtils.filter(process.stdin),
			// Legacy terminal input cannot say which modifiers a key was pressed
			// with: an arrow under Shift, under Alt, or under both can all arrive
			// as the same bytes, which is what leaves Alt and Shift selection to
			// the terminal's own key mapping. The kitty protocol reports them
			// apart, and the query behind `auto` is ignored by terminals that do
			// not speak it, so the ones that do need no setting turned on.
			kittyKeyboard: { mode: "auto" },
		},
	);
});

export { cli };
