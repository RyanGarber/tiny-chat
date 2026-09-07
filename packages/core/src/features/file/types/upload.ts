import { z } from "zod";
import type { Model } from "../../../core/services/PostgresService.ts";
import { zId } from "../../../core/types/common.ts";

export type UploadState = Model["Upload"];

/**
 * An upload as the client learns of it — from creating one, or from cloning a
 * repository. An upload is attached by referencing its directory on the chat
 * mount, so this is what an attachment directive is built out of.
 */
export const zUploadResult = z.object({
	id: zId,
	name: z.string(),
	thumbnail: z.custom<Uint8Array>().nullish(),
});
export type zUploadResult = z.infer<typeof zUploadResult>;
