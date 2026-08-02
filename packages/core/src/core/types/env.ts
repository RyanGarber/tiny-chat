import { z } from "zod";

export const zEnv = z.object({
	VITE_SERVER_URL: z.string().max(255),
	VITE_SERVER_PORT: z.string().regex(/^\d+$/),
	VITE_WEB_URL: z.string().max(255),
	VITE_WEB_PORT: z.string().regex(/^\d+$/),
	DEV: z.string().default(""),
});
export type zEnv = z.infer<typeof zEnv>;

export const zProviderEnv = zEnv.extend({
	PROVIDER_RELAY_URL: z.string().max(255).default(""),
});
export type zProviderEnv = z.infer<typeof zProviderEnv>;

export const zServerEnv = zEnv.extend({
	PG_HOST: z.string().max(255),
	PG_PORT: z.string().regex(/^\d+$/),
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
