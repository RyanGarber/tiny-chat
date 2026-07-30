import "./env.ts";

import { Command } from "@commander-js/extra-typings";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ModelProviderStatus } from "@tiny-chat/shared/src/features/provider/types/model.ts";
import { initLogs } from "@tiny-chat/shared/src/logs.ts";
import { render } from "ink";
import tauri from "../../tauri/tauri.conf.json" with { type: "json" };
import App from "./core/components/App.tsx";
import { tRPCQueryClient } from "./core/services/tRPCService.ts";

if (import.meta.main) initLogs(undefined, true);

const cli = new Command()
	.name("tiny-chat")
	.description("Tiny Chat in the terminal.")
	.version(tauri.version);

cli.action(() => {
	render(
		<QueryClientProvider client={tRPCQueryClient}>
			<App />
		</QueryClientProvider>,
	);
});

export { cli };
