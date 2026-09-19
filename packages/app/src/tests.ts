import { MantineProvider } from "@mantine/core";
import {
	create,
	onAfterAll,
	onBeforeAll,
} from "@tiny-chat/client/src/tests.ts";
import { createElement, type ReactNode } from "react";
import { render as _render } from "vitest-browser-react";
import mantineTheme, { cssResolver } from "#app/theme.tsx";

beforeAll(async () => {
	return await onBeforeAll({
		env: {
			VITE_SERVER_URL: String(import.meta.env.VITE_SERVER_URL),
			VITE_SERVER_PORT: String(import.meta.env.VITE_SERVER_PORT),
			VITE_WEB_URL: String(import.meta.env.VITE_WEB_URL),
			VITE_WEB_PORT: String(import.meta.env.VITE_WEB_PORT),
			DEV: String(import.meta.env.DEV),
		},
	});
});

export async function render(children: ReactNode) {
	const { root } = create(
		createElement(MantineProvider, {
			theme: mantineTheme,
			cssVariablesResolver: cssResolver,
			children,
		}),
	);
	return _render(root);
}

afterAll(async () => {
	return await onAfterAll();
});
