import chalk from "chalk";
import { describe, it } from "vitest";
import { DiffUtils } from "./DiffUtils.ts";

describe("DiffUtils", () => {
	it("calculates a diff", () => {
		const diff = DiffUtils.context(
			DiffUtils.diff({
				before: `
# Test
print("unchanged")
print(response.status_code)
print("more unchanged")
print(response.status_code)
return response.text
`,
				after: `
# Test
print("unchanged")
print((response))
print("more unchanged")
print(response.json())
return response.json()
`,
			}),
			{ contextLines: 1 },
		);

		for (const change of diff) {
			switch (change.type) {
				case "removed":
					console.log(chalk.red(`- ${change.line}`));
					break;
				case "added":
					console.log(chalk.green(`+ ${change.line}`));
					break;
				case "changed": {
					let line = "~ ";
					for (const part of change.parts) {
						switch (part.type) {
							case "added":
								line += chalk.green(part.part);
								break;
							case "removed":
								line += chalk.red(part.part);
								break;
							case "changed":
								line += chalk.underline(
									chalk.red(part.partBefore) + chalk.green(part.partAfter),
								);
								break;
							case "unchanged":
								line += part.part;
								break;
						}
					}
					console.log(line);
					break;
				}
				case "context":
					console.log(chalk.gray(`  ${change.line}`));
					break;
				case "unchanged":
					console.log(chalk.gray(`  (${change.lines.length} lines hidden)`));
					break;
			}
		}
	});
});
