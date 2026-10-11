import { fileURLToPath } from "node:url";
import { defineRuntimeConfig } from "../../packages/gui/vite.config.ts";

export default defineRuntimeConfig({
	runtime: fileURLToPath(new URL("./src/client-runtime.ts", import.meta.url)),
	dist: fileURLToPath(new URL("./dist", import.meta.url)),
});
