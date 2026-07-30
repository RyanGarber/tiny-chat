import { z } from "zod";

export const zStringify = z
	.union([z.string(), z.number(), z.boolean()])
	.transform((value) => String(value));
export type zStringify = z.infer<typeof zStringify>;
