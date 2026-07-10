import { inject } from "vitest";
import type { TestProject } from "vitest/node";
import type { ChatProvider } from "./providers/chat/index.ts";
import { TestProvider } from "./providers/chat/test.ts";
import { zConfig } from "./types/chat.ts";
import type { zUser } from "./types/user.ts";

declare module "vitest" {
	interface ProvidedContext {
		shared_user: zUser;
		shared_config: zConfig;
	}
}

export async function setup(project: TestProject) {
	console.log("[tests] setting up test user (mocked)");
	const user: zUser = {
		id: "__TEST__",
		name: "__TEST__",
		settings: {},
		isEphemeral: true,
	};

	const models = await TestProvider.getModels(user);
	const model = models.find((m) => m.features.includes("generate"));
	if (!model) throw new Error("Failed to get test model");

	const config: zConfig = zConfig.parse({
		provider: TestProvider.name,
		model: model.name,
		args: model.args.map((arg) => ({
			name: arg.name,
			value: arg.default,
		})),
	});

	console.log("[tests] test user ready", user);
	project.provide("shared_user", user);
	project.provide("shared_config", config);

	return () => {
		// nothing to clean up
	};
}

export function testConfig(
	provider: ChatProvider,
	model: string,
	config = inject("shared_config"),
): zConfig {
	return {
		...config,
		provider: provider.name,
		model,
		args: Object.fromEntries(
			provider
				.getModelArgs(model)
				.map((arg) => [arg.name, arg.default] as const),
		),
	};
}
