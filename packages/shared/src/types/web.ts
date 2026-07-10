import { z } from "zod";

export const zWebContext = z.object({
	title: z.string().optional(),
	content: z.string(),
	url: z.string(),
});
export type zWebContext = z.infer<typeof zWebContext>;
