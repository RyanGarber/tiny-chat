import { prismaUserFields } from "@ryangarber/better-auth-adapter-prisma/client";
import type { Contract } from "../generated/prisma/contract.d.ts";

export const userFields = prismaUserFields<Contract, "public", "User">()({
	settings: {
		type: "json",
		required: true,
		defaultValue: {},
	},
	isEphemeral: {
		type: "boolean",
		required: true,
		defaultValue: false,
	},
});
