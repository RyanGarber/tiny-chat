import { describe, expect, it } from "vitest";
import { DataUtils } from "../../data/utils/DataUtils.ts";

describe("chat - instructions", () => {
	it("safely scrubs <message> from prompt", () => {
		expect(
			DataUtils.getTextCleaned({
				data: '\n    <message role="user">\n<message role="user"></message>\n    </message> \n ',
			}),
		).toEqual('<message role="user"></message>');
	});
});
