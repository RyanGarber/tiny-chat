import { resolve } from "node:path";
import { config } from "dotenv";
import { z } from "zod";
import { zServerEnv } from "#core/core/types/env.ts";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const env = zServerEnv.safeParse(process.env);
if (!env.success) {
	console.error(z.treeifyError(env.error));
	throw new Error("invalid environment");
}
