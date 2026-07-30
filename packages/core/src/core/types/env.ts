import { z } from "zod";
import { zStringify } from "./common.ts";

export const zEnv = z.object({
	VITE_SERVER_URL: z.string().max(255),
	VITE_SERVER_PORT: z.string().regex(/^\d+$/).transform(Number),
	VITE_SERVER_PATH_API: z.string().max(255),
	VITE_SERVER_PATH_AUTH: z.string().max(255),
	VITE_SERVER_PATH_MCP: z.string().max(255),
	VITE_WEB_URL: z.string().max(255),
	VITE_WEB_PORT: z.string().regex(/^\d+$/).transform(Number),
	DEV: zStringify
		.transform((value) => value === "true" || value === "1")
		.default(false),
});
export type zEnv = z.infer<typeof zEnv>;

export const zServerEnv = zEnv.extend({
	PG_HOST: z.string().max(255),
	PG_PORT: z.string().regex(/^\d+$/).transform(Number),
	PG_USER: z.string().max(255),
	PG_PASSWORD: z.string().max(255),
	PG_DATABASE: z.string().max(255),
	AUTH_GITHUB_CLIENT: z.string().max(255),
	AUTH_GITHUB_SECRET: z.string().max(255),
	AUTH_GOOGLE_CLIENT: z.string().max(255),
	AUTH_GOOGLE_SECRET: z.string().max(255),
	AUTH_HUGGINGFACE_CLIENT: z.string().max(255),
	AUTH_HUGGINGFACE_SECRET: z.string().max(255),
});
export type zServerEnv = z.infer<typeof zServerEnv>;
