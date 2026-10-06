import ToolBlock from "#gui/features/part/components/ToolBlock.tsx";
import Web from "#gui/features/part/components/Web.tsx";
import { render } from "#gui/tests.ts";

const source = {
	url: "https://example.com/article",
	title: "Example article",
	content: "First paragraph.\n\nSecond paragraph with **emphasis**.",
};

describe("web content", () => {
	it("renders web tool results as full Markdown with title and URL", async () => {
		const screen = await render(
			<ToolBlock block={{ type: "web", source }} active={false} />,
		);
		expect(screen.getByText(source.title)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: source.url })).toHaveAttribute(
			"href",
			source.url,
		);
		expect(screen.getByText("First paragraph.")).toBeInTheDocument();
		expect(screen.getByText("emphasis")).toBeInTheDocument();
	});

	it("falls back to the hostname for a nullish title in previews", async () => {
		const screen = await render(
			<Web source={{ ...source, title: undefined }} />,
		);
		expect(
			screen.getByText("example.com", { exact: true }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: source.url })).toBeInTheDocument();
	});
});
