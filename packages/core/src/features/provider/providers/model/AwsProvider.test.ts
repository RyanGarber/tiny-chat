import { mockConfig, mockUser } from "../../../../tests.ts";
import { AwsProvider } from "./AwsProvider.ts";
import { AzureProvider } from "./AzureProvider.ts";

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
