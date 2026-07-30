import { z } from "zod";
import type { Upload } from "../../../../../server/generated/prisma/browser.ts";
import type { zDataPart } from "../../data/types/message.ts";

export { UploadType } from "../../../../../server/generated/prisma/browser.ts";

export type UploadState = Upload;

export const zUploadResult = z.custom<Extract<zDataPart, { type: "upload" }>>();
export type zUploadResult = z.infer<typeof zUploadResult>;
