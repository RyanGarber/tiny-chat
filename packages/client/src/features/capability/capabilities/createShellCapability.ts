import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { Client } from "../../../client.ts";

export const createShellCapability: CapabilityFactory<
	{ client: Client },
	ShellCapability
> = ({ client }) => {
	if (!client.shell) throw new Error("missing client shell");

	return Promise.resolve(client.shell);
};
