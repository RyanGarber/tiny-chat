import { inject } from "vitest";
import type { TestProject } from "vitest/node";
import { zConfig } from "./features/data/types/message.ts";
import type { zUser } from "./features/data/types/user.ts";
import { TestProvider } from "./features/provider/providers/model/TestProvider.ts";
import type { ModelProvider } from "./features/provider/types/model.ts";

declare module "vitest" {
	interface ProvidedContext {
		shared_user: zUser;
		shared_config: zConfig;
	}
}

export async function setup(project: TestProject) {
	console.log("setting up shared test user (mocked)...");
	const user: zUser = {
		id: "__TEST__",
		name: "__TEST__",
		settings: {},
		isEphemeral: true,
	};

	const { models } = await TestProvider.getStatus({ user });
	const model = models.find((m) => m.features.includes("language"));
	if (!model) throw new Error("failed to get test model");

	const config: zConfig = zConfig.parse({
		provider: TestProvider.name,
		model: model.name,
		args: model.args.map((arg) => ({
			name: arg.name,
			value: arg.default,
		})),
	});

	console.log("shared test user ready", user);
	project.provide("shared_user", user);
	project.provide("shared_config", config);

	return () => {
		// nothing to clean up
	};
}

export function testConfig(
	provider: ModelProvider<any>,
	model: string,
	config = inject("shared_config"),
): zConfig {
	return {
		...config,
		provider: provider.name,
		model,
		args: Object.fromEntries(
			provider
				.getModelArgs({ model })
				.map((arg) => [arg.name, arg.default] as const),
		),
	};
}
