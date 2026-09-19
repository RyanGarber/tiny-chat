/// <reference types="../vitest.context.d.ts" />

import type { TestProject } from "vitest/node";
import { serverUrl, useServerProcess } from "./use-server.ts";

export async function setup(project: TestProject) {
	const cleanup = await useServerProcess();

	project.provide("serverUrl", serverUrl);

	return () => cleanup();
}
