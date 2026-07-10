import "#frontend/main.css";
import "streamdown/styles.css";

import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "#frontend/core/components/App.tsx";
import { useLogStore } from "#frontend/core/stores/useLogStore.tsx";
import { queryClient } from "#frontend/utils/api.ts";
import { initLogs } from "#shared/logs.ts";

initLogs(useLogStore.getState().writeLog, false);

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</React.StrictMode>,
);
