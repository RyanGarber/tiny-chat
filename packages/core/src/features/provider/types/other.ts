import type { Provider, ProviderStatus } from "./provider.ts";

export interface OtherProvider extends Provider<ProviderStatus> {
	type: "other";
}
