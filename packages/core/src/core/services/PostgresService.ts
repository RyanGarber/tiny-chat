import type { DefaultModelRow } from "@prisma/orm-postgres/orm-client";
import type { Contract } from "../../../generated/prisma/contract.d.ts";
import contractJson from "../../../generated/prisma/contract.json" with {
	type: "json",
};

export const Model = contractJson.domain.namespaces.public.models;

export type Model = {
	[K in keyof typeof contractJson.domain.namespaces.public.models]: DefaultModelRow<
		Contract,
		K,
		"public"
	>;
};

type ValueSet =
	Contract["storage"]["namespaces"]["public"]["entries"]["valueSet"];

export const Enum = contractJson.storage.namespaces.public.entries
	.valueSet as unknown as ValueSet;

export type Enum = {
	[K in keyof typeof Enum]: ValueSet[K]["values"][number];
};
