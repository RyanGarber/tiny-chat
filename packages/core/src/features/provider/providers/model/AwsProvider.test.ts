import { AwsProvider } from "#core/features/provider/providers/model/AwsProvider.ts";
import { AzureProvider } from "#core/features/provider/providers/model/AzureProvider.ts";
import { mockConfig, mockUser } from "#core/tests.ts";

describe("AwsProvider", () => {
	it("provides the appropriate provider options", () => {
		const options = AwsProvider.getSdkOptions({
			user: mockUser(),
			config: mockConfig(AwsProvider, "amazon-luna-2"),
			env: {},
		});
		expect(options?.bedrock?.reasoningConfig?.type).toBe("enabled");

		const options2 = AzureProvider.getSdkOptions({
			user: mockUser(),
			config: mockConfig(AzureProvider, "claude-sonnet-5"),
			env: {},
		});
		expect(options2?.anthropic?.thinking?.type).toBe("adaptive");
	});
});
