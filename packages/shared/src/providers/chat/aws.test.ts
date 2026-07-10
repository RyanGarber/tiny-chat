import { describe, expect, inject, it } from "vitest";
import { testConfig } from "../../tests.ts";
import { AWSProvider } from "./aws.ts";
import { AzureProvider } from "./azure.ts";

describe("providers - aws", () => {
	it("provides the appropriate provider options", () => {
		const options = AWSProvider.getClientOptions(
			inject("shared_user"),
			testConfig(AWSProvider, "amazon-luna-2"),
			{},
		);
		expect(options?.bedrock?.reasoningConfig?.type).toBe("enabled");

		const options2 = AzureProvider.getClientOptions(
			inject("shared_user"),
			testConfig(AWSProvider, "claude-sonnet-5"),
			{},
		);
		expect(options2?.anthropic?.thinking?.type).toBe("adaptive");
	});
});
