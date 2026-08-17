import { z } from "zod";
import type { Upload } from "../../../../../server/generated/prisma/browser.ts";

export { UploadType } from "../../../../../server/generated/prisma/browser.ts";

export type UploadState = Upload;

/**
 * An upload as the client learns of it — from creating one, or from cloning a
 * repository. An upload is attached by referencing its directory on the chat
 * mount, so this is what an attachment directive is built out of.
 */
export const zUploadResult = z.object({
	id: z.cuid2(),
	name: z.string(),
	thumbnail: z.string().optional(),
});
export type zUploadResult = z.infer<typeof zUploadResult>;
