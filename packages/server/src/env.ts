import { resolve } from "node:path";
import { zServerEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { config } from "dotenv";
import { z } from "zod";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const env = zServerEnv.safeParse(process.env);
if (!env.success) {
	console.error(z.treeifyError(env.error));
	throw new Error("invalid environment");
}
