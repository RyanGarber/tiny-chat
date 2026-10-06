import { setText } from "@crosscopy/clipboard";
import { vi } from "vitest";
import { ClipboardService } from "#tui/core/services/ClipboardService.ts";

vi.mock("@crosscopy/clipboard", () => ({
	setText: vi.fn().mockResolvedValue(undefined),
}));

it("copies plain text without terminal formatting, preserving whitespace", () => {
	ClipboardService.copy(
		"\x1b[1;31mred\x1b[0m\ttext\n\x1b]8;;https://example.com\x07link\x1b]8;;\x07",
	);

	expect(setText).toHaveBeenCalledWith("red\ttext\nlink");
});

it("leaves ordinary code and backslash escapes intact", () => {
	ClipboardService.copy("const color = '\\x1b[31m';\n\treturn color;");

	expect(setText).toHaveBeenCalledWith(
		"const color = '\\x1b[31m';\n\treturn color;",
	);
});
