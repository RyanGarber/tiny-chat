import "@testing-library/jest-dom/vitest";

import { MantineProvider } from "@mantine/core";
import { render as _render, cleanup } from "@testing-library/react";
import {
	create,
	onAfterAll,
	onBeforeAll,
} from "@tiny-chat/client/src/tests.ts";
import type { ReactNode } from "react";
import { cssResolver, theme as mantineTheme } from "#app/theme.tsx";

export * from "@testing-library/react";

const globals = globalThis as any;
if (typeof globals.window !== "undefined") {
	Object.defineProperty(globals.window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(), // deprecated
			removeListener: vi.fn(), // deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
}

beforeAll(async () => {
	return await onBeforeAll();
});

export async function render(children: ReactNode) {
	const { root } = create(
		<MantineProvider theme={mantineTheme} cssVariablesResolver={cssResolver}>
			{children}
		</MantineProvider>,
	);
	return _render(root);
}

afterEach(() => {
	cleanup();
});

afterAll(async () => {
	return await onAfterAll();
});
