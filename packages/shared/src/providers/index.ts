import type { zCache, zUser } from "../types/user.ts";
import { chatProviders } from "./chat/index.ts";
import { otherProviders } from "./other/index.ts";
import { webProviders } from "./web/index.ts";

/** Shared structure every provider must expose. */
export interface BaseProvider {
	name: string;
	/** Setting keys whose values users supply (e.g. 'apiKey'). */
	settings: string[];
}

/** Shared shape returned by the providers.list route for every category. */
export interface BaseProviderStatus {
	name: string;
	settings: string[];
	error?: string;
}

/** Run `check()` and fold errors into the status object. */
export async function checkProvider(
	user: zUser,
	provider: BaseProvider & { check: (user: zUser) => Promise<boolean> },
): Promise<BaseProviderStatus & { available: boolean }> {
	try {
		return {
			name: provider.name,
			settings: provider.settings,
			available: await provider.check(user),
		};
	} catch (e) {
		console.error(`Failed to test provider ${provider.name}:`, e);
		return {
			name: provider.name,
			settings: provider.settings,
			available: false,
			error: (e as Error).message ?? (e as Error).name ?? "Unknown",
		};
	}
}

export async function fetchProviders(user: zUser) {
	const providers: zCache["providers"] = { chat: [], web: [], other: [] };

	for (const provider of chatProviders) {
		try {
			const models = await provider.getModels(user);
			providers.chat.push({
				name: provider.name,
				settings: provider.settings,
				models: models,
			});
		} catch (e) {
			console.error(`Failed to fetch models from ${provider.name}:`, e);
			providers.chat.push({
				name: provider.name,
				settings: provider.settings,
				models: [],
				error: (e as Error).message ?? (e as Error).name ?? "Unknown",
			});
		}
	}

	providers.web = await Promise.all(
		webProviders.map((p) => checkProvider(user, p)),
	);

	providers.other = await Promise.all(
		otherProviders.map((p) => checkProvider(user, p)),
	);

	return providers;
}
