import type {
	BrowserCapability,
	CapabilityFactory,
} from "@tiny-chat/core/core/types/capability.ts";
import type { Client } from "../../client.ts";
import { ClientBrowserService } from "../../features/agent/services/ClientBrowserService.ts";

export const createBrowserCapability: CapabilityFactory<
	{ client: Client },
	BrowserCapability
> = async ({ client }) => ({
	status: () => ClientBrowserService.getStatus({ client }),
	run: ({ steps, screenshot, abort }) =>
		ClientBrowserService.run({ client, steps, screenshot, abort }),
});
