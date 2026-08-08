import "#app/main.css";
import "streamdown/styles.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { ClientContext } from "@tiny-chat/client/src/client.ts";
import React from "react";
import ReactDOM from "react-dom/client";
import { client } from "#app/client.ts";
import App from "#app/core/components/App.tsx";
import { useConsoleStore } from "#app/core/stores/useConsoleStore.ts";
import { createLogger } from "#core/logger.ts";

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
