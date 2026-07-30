import { LegiscanClient, State } from "@ryangarber/legiscan-ts";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { OtherProvider } from "../../types/other.ts";

export const LegiscanProvider: OtherProvider = {
	name: "legiscan",
	type: "other",
	settings: ["apiKey"],

	async getStatus({ user }) {
		if (!user.settings.providers?.legiscan?.apiKey) return { valid: false };

		try {
			const client = new LegiscanClient(
				user.settings.providers.legiscan.apiKey as string,
			);

			await client.getSessionList({ state: State.DC });

			return { valid: true };
		} catch (error) {
			return {
				valid: false,
				error: CommonUtils.getErrorFormatted({ error }),
			};
		}
	},
};
