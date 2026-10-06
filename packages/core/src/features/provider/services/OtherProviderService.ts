import { LegiscanProvider } from "#core/features/provider/providers/other/LegiscanProvider.ts";
import type { OtherProvider } from "#core/features/provider/types/other.ts";

export const OtherProviderService = {
	providers: [LegiscanProvider] satisfies OtherProvider[],
} as const;
