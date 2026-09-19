import Text from "../../../core/components/Text.tsx";
import render from "../../../tests.ts";
import Quote from "./Quote.tsx";

describe("Quote", () => {
	it("renders model names to quotes", async () => {
		const screen = await render(
			<Quote model="gpt-6">
				<Text>Quote from GPT 6.</Text>
			</Quote>,
		);
		expect(screen.lastFrame()?.includes("gpt-6")).toBe(true);
		screen.unmount();
		screen.cleanup();
	});
});
