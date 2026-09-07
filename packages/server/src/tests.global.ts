import type { TestProject } from "vitest/node";
import { serverUrl, useServerProcess } from "../../../scripts/use-server.ts";

declare module "vitest" {
	export interface ProvidedContext {
		serverUrl: string;
	}
}

export async function setup(project: TestProject) {
	const cleanup = await useServerProcess();

	project.provide("serverUrl", serverUrl);

	return async () => cleanup();
}
