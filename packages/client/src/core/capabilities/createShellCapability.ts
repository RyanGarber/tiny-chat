import type { Client } from "#client/client.ts";
import type {
	CapabilityFactory,
	ShellCapability,
} from "#core/core/types/capability.ts";

export const createShellCapability: CapabilityFactory<
	{ client: Client },
	ShellCapability
> = async ({ client }) => {
	if (!client.shell) throw new Error("missing client shell");

	await client.workingDirectory.ready();
	return client.shell;
};
