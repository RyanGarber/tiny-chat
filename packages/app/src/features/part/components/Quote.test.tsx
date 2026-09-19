import Quote from "#app/features/part/components/Quote.tsx";
import { render } from "#app/tests.ts";

describe("Quote", () => {
	it("renders model names in quotes", async () => {
		const screen = await render(<Quote model="gpt-6">Quote from GPT 6.</Quote>);
		expect(screen.getByText("gpt-6")).toBeInTheDocument();
	});
});
