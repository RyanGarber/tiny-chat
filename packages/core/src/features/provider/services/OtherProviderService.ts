import { LegiscanProvider } from "../providers/other/LegiscanProvider.ts";
import type { OtherProvider } from "../types/other.ts";

export const OtherProviderService = {
	providers: [LegiscanProvider] satisfies OtherProvider[],
} as const;
