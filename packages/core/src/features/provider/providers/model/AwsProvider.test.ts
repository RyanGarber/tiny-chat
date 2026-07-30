import { describe, expect, inject, it } from "vitest";
import { testConfig } from "../../../../tests.ts";
import { AwsProvider } from "./AwsProvider.ts";
import { AzureProvider } from "./AzureProvider.ts";

describe("providers - aws", () => {
	it("provides the appropriate provider options", () => {
		const options = AwsProvider.getSdkOptions({
			user: inject("shared_user"),
			config: testConfig(AwsProvider, "amazon-luna-2"),
			env: {},
		});
		expect(options?.bedrock?.reasoningConfig?.type).toBe("enabled");

		const options2 = AzureProvider.getSdkOptions({
			user: inject("shared_user"),
			config: testConfig(AzureProvider, "claude-sonnet-5"),
			env: {},
		});
		expect(options2?.anthropic?.thinking?.type).toBe("adaptive");
	});
});
