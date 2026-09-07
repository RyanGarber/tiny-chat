import "temporal-polyfill/full/global";

import { zConfig } from "./features/data/types/message.ts";
import type { zUser } from "./features/data/types/user.ts";
import { TestProvider } from "./features/provider/providers/model/TestProvider.ts";
import type { ModelProvider } from "./features/provider/types/model.ts";

export function mockUser(overrides: Partial<zUser> = {}): zUser {
	return {
		id: "__TEST__",
		name: "__TEST__",
		settings: {},
		isEphemeral: true,
		...overrides,
	};
}

export function mockConfig(
	provider: ModelProvider<any> = TestProvider,
	model: string = "test-generate",
): zConfig {
	return zConfig.parse({
		provider: provider.name,
		model,
		args: Object.fromEntries(
			provider
				.getModelArgs({ model })
				.map((arg) => [arg.name, arg.default] as const),
		),
	});
}
