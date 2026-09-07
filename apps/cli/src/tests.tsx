import {
	create,
	onAfterAll,
	onBeforeAll,
} from "@tiny-chat/client/src/tests.ts";
import { render as _render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterAll, beforeAll } from "vitest";

beforeAll(async () => {
	return await onBeforeAll();
});

export default async function render(children: ReactNode) {
	const { root } = create(children);
	return _render(root);
}

afterAll(async () => {
	return await onAfterAll();
});
