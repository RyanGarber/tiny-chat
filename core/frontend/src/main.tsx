import "@mantine/core/styles.css";
import '@mantine/code-highlight/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import '@mantine/nprogress/styles.css';
import "@mantine/carousel/styles.css";
import "@/main.css";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App.tsx";
import {Router} from "wouter";
import {useHashLocation} from "wouter/use-hash-location";
import {checkForUpdates} from "@/utils.ts";

void checkForUpdates();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <Router hook={useHashLocation}>
            <App/>
        </Router>
    </React.StrictMode>,
);
