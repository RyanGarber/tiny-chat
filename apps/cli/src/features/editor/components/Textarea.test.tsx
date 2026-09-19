import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { useContext } from "react";
import render from "../../../tests.ts";
import { MarkdownUtils } from "../utils/MarkdownUtils.ts";
import Textarea from "./Textarea.tsx";

/** The text area as the editor sets it up, drawn over markdown. */
function Harness({ value }: { value: string }) {
	const { colorScheme } = useContext(ThemeContext);

	return (
		<Textarea
			focus={false}
			value={value}
			onChange={() => {}}
			labels={MarkdownUtils.labels()}
			styles={MarkdownUtils.styles(colorScheme)}
		/>
	);
}

describe("markdown in the editor", () => {
	/**
	 * Every rule run against a value by the text area itself, which is where a
	 * pattern it cannot take would throw, and the syntax left standing under it.
	 *
	 * Nothing is styled at all when the frame is drawn to a pipe rather than a
	 * terminal, so what the labels are painted under is checked over the rules
	 * themselves, in `MarkdownUtils.test.tsx`.
	 */
	it("draws the markdown it styles without taking any of it away", async () => {
		const value = [
			"# Heading",
			"- item *one*",
			"- [ ] todo `read()`",
			"> quoted **hard**",
			"",
			"```ts",
			"const a = b;",
			"```",
			"see [docs](https://x.dev) ~~gone~~",
		].join("\n");

		const screen = await render(<Harness value={value} />);

		for (const line of value.split("\n")) {
			if (line) expect(screen.lastFrame()).toContain(line);
		}

		screen.unmount();
		screen.cleanup();
	});
});
