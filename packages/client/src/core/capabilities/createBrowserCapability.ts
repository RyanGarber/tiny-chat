import type { Client } from "#client/client.ts";
import { ClientBrowserService } from "#client/features/agent/services/ClientBrowserService.ts";
import type {
	BrowserCapability,
	CapabilityFactory,
} from "#core/core/types/capability.ts";

export const createBrowserCapability: CapabilityFactory<
	{ client: Client },
	BrowserCapability
> = async ({ client }) => ({
	status: () => ClientBrowserService.getStatus({ client }),
	run: ({ steps, screenshot, abort }) =>
		ClientBrowserService.run({ client, steps, screenshot, abort }),
});
