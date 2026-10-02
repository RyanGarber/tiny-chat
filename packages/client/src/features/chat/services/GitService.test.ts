import { execSync, spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ShellCapability } from "@tiny-chat/core/core/types/capability.ts";
import { GitService } from "./GitService.ts";

// The machine's own shell, as the CLI and desktop hand it over.
const shell: ShellCapability = {
	readFile: async ({ path }) => ({ path, data: readFileSync(path) }),
	readDir: async () => [],
	writeFile: async ({ path }) => ({ path, success: true }),
	exec: async ({ command }) => {
		const result = spawnSync(command, { shell: true, encoding: "utf8" });
		return {
			code: result.status ?? undefined,
			stdout: result.stdout,
			stderr: result.stderr,
		};
	},
};

describe("GitService", () => {
	let root: string;
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "git-service-"));
		const git = (args: string) =>
			execSync(`git -c user.name=t -c user.email=t@t ${args}`, { cwd: root });
		git("init -q");
		mkdirSync(join(root, "src/deep"), { recursive: true });
		writeFileSync(join(root, "src/a.ts"), "one\ntwo\nthree\n");
		writeFileSync(join(root, "gone.txt"), "x\ny\n");
		git("add -A");
		git("commit -qm init");
		writeFileSync(join(root, "src/a.ts"), "one\n2\nthree\nfour\n");
		rmSync(join(root, "gone.txt"));
		writeFileSync(join(root, "src/deep/new file.ts"), "a\nb\nc");
	});
	afterAll(() => rmSync(root, { recursive: true, force: true }));

	it("finds the repository from anywhere inside it, once", async () => {
		const found = await GitService.roots({
			shell,
			directories: [join(root, "src/deep"), join(root, "src"), tmpdir()],
		});
		expect(found).toEqual([root]);
	});

	it("reports tracked and untracked changes", async () => {
		const repo = await GitService.status({ shell, root });
		expect(repo.head).toBe(true);
		const byPath = Object.fromEntries(
			repo.changes.map((change) => [change.path, change]),
		);
		expect(byPath[`${root}/src/a.ts`]).toMatchObject({
			additions: 2,
			deletions: 1,
			untracked: false,
		});
		expect(byPath[`${root}/gone.txt`]).toMatchObject({
			additions: 0,
			deletions: 2,
		});
		expect(byPath[`${root}/src/deep/new file.ts`]).toMatchObject({
			additions: 3,
			untracked: true,
		});
	});

	it("reads a file as it was at the last commit", async () => {
		const repo = await GitService.status({ shell, root });
		const change = repo.changes.find((change) => change.path.endsWith("a.ts"));
		const untracked = repo.changes.find((change) => change.untracked);
		if (!change || !untracked) throw new Error("missing changes");
		expect(await GitService.original({ shell, repo, change })).toBe(
			"one\ntwo\nthree\n",
		);
		expect(await GitService.original({ shell, repo, change: untracked })).toBe(
			"",
		);
	});
});
