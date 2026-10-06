import type {
	Provider,
	ProviderStatus,
} from "#core/features/provider/types/provider.ts";

export interface OtherProvider extends Provider<ProviderStatus> {
	type: "other";
}
