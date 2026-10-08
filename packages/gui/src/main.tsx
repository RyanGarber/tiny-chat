import "#gui/main.css";
import "streamdown/styles.css";

import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { ClientContext } from "#client/client.ts";
import { useConsoleStore } from "#client/core/stores/useConsoleStore.ts";
import { createLogger } from "#core/logger.ts";
import { client } from "#gui/client.ts";
import App from "#gui/core/components/App.tsx";

createLogger({ logWriter: useConsoleStore.getState().writer });

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<QueryClientProvider client={client.queryClient}>
			<ClientContext value={client}>
				<App />
			</ClientContext>
		</QueryClientProvider>
	</React.StrictMode>,
);
