import "#ui/main.css";
import "streamdown/styles.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { ClientProvider } from "@tiny-chat/react/src/client.ts";
import React from "react";
import ReactDOM from "react-dom/client";
import { createLogger } from "#core/logger.ts";
import { client } from "#ui/client.ts";
import App from "#ui/core/components/App.tsx";
import { useLogStore } from "#ui/core/stores/useLogStore.tsx";

createLogger({ logWriter: useLogStore.getState().writer });

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<QueryClientProvider client={client.queryClient}>
			<ClientProvider value={client}>
				<App />
			</ClientProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
