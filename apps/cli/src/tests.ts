/// <reference types="../../../vitest.context.d.ts" />

import {
	create,
	onAfterAll,
	onBeforeAll,
} from "@tiny-chat/client/src/tests.ts";
import { render as _render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterAll, beforeAll } from "vitest";

beforeAll(async () => {
	return await onBeforeAll({
		env: {
			VITE_SERVER_URL: String(process.env.VITE_SERVER_URL),
			VITE_SERVER_PORT: String(process.env.VITE_SERVER_PORT),
			VITE_WEB_URL: String(process.env.VITE_WEB_URL),
			VITE_WEB_PORT: String(process.env.VITE_WEB_PORT),
			DEV: String(process.env.DEV),
		},
	});
});

export default async function render(children: ReactNode) {
	const { root } = create(children);
	return _render(root);
}

afterAll(async () => {
	return await onAfterAll();
});
