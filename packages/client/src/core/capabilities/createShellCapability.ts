import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { Client } from "../../client.ts";

export const createShellCapability: CapabilityFactory<
	{ client: Client },
	ShellCapability
> = async ({ client }) => {
	if (!client.shell) throw new Error("missing client shell");

	await client.workingDirectory.ready();
	return client.shell;
};
