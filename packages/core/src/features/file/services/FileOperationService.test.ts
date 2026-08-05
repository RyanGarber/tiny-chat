import { describe, expect, it } from "vitest";
import type { ShellCapability } from "../../capability/types/capability.ts";
import { FileOperationService } from "./FileOperationService.ts";

const createShell = (initial: Record<string, string>): ShellCapability => {
	const files = new Map(Object.entries(initial));
	return {
		readFile: async ({ path }) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`Missing file: ${path}`);
			return { path, data: new TextEncoder().encode(content) };
		},
		readDir: async ({ path }) => {
			const prefix = path.endsWith("/") ? path : `${path}/`;
			const entries = new Map<string, boolean>();
			for (const filePath of files.keys()) {
				if (!filePath.startsWith(prefix)) continue;
				const remainder = filePath.slice(prefix.length);
				const [name, ...rest] = remainder.split("/");
				entries.set(`${prefix}${name}`, rest.length > 0);
			}
			return [...entries].map(([entryPath, is_dir]) => ({
				path: entryPath,
				is_dir,
			}));
		},
		writeFile: async ({ path, content }) => {
			files.set(path, content);
			return { path, success: true };
		},
		exec: async () => ({ stdout: "", stderr: "" }),
	};
};

describe("FileOperationService", () => {
	it("searches file paths and text recursively while excluding dependencies", async () => {
		const shell = createShell({
			"/project/src/user-service.ts": "export const getUser = () => user;",
			"/project/src/other.ts": "nothing relevant",
			"/project/node_modules/user.ts": "user user user",
		});

		await expect(
			FileOperationService.searchFiles({
				shell,
				path: "/project",
				query: "user",
			}),
		).resolves.toEqual([
			expect.objectContaining({ path: "/project/src/user-service.ts" }),
		]);
	});

	it("greps text with a regular expression", async () => {
		const shell = createShell({
			"/project/a.ts": "const answer = 42;",
			"/project/b.ts": "const answer = 'unknown';",
		});

		const results = await FileOperationService.grepFiles({
			shell,
			path: "/project",
			query: "answer\\s*=\\s*42",
		});
		expect(results.map((result) => result.path)).toEqual(["/project/a.ts"]);
	});

	it("edits through primitive reads and writes", async () => {
		const shell = createShell({ "/project/a.ts": "const value = 1;\n" });

		await expect(
			FileOperationService.editFile({
				shell,
				path: "/project/a.ts",
				old_string: "value = 1",
				new_string: "value = 2",
			}),
		).resolves.toEqual({
			path: "/project/a.ts",
			success: true,
			replacements: 1,
		});
		await expect(shell.readFile({ path: "/project/a.ts" })).resolves.toEqual({
			path: "/project/a.ts",
			data: new TextEncoder().encode("const value = 2;\n"),
		});
	});
});
