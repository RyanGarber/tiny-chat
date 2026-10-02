import { GitUtils } from "./GitUtils.ts";

describe("GitUtils", () => {
	it("quotes paths as one shell word", () => {
		expect(GitUtils.quote("/a b/c")).toBe('"/a b/c"');
		expect(GitUtils.quote('/a"$`\\b')).toBe('"/a\\"\\$\\`\\\\b"');
	});

	it("finds the root from a directory and its prefix", () => {
		expect(GitUtils.root({ directory: "/repo", prefix: "\n" })).toBe("/repo");
		expect(
			GitUtils.root({
				directory: "/repo/packages/app",
				prefix: "packages/app/\n",
			}),
		).toBe("/repo");
		expect(
			GitUtils.root({ directory: "/elsewhere", prefix: "app/" }),
		).toBeNull();
		expect(GitUtils.root({ directory: "C:\\repo\\app", prefix: "app/" })).toBe(
			"C:/repo",
		);
	});

	it("parses -z numstat, including binary files and odd names", () => {
		expect(
			GitUtils.numstat({
				root: "/repo",
				output: "3\t1\tsrc/a.ts\0-\t-\timg.png\0" + "1\t0\twith\ttab.txt\0",
			}),
		).toEqual([
			{
				path: "/repo/src/a.ts",
				additions: 3,
				deletions: 1,
				untracked: false,
				binary: false,
			},
			{
				path: "/repo/img.png",
				additions: 0,
				deletions: 0,
				untracked: false,
				binary: true,
			},
			{
				path: "/repo/with\ttab.txt",
				additions: 1,
				deletions: 0,
				untracked: false,
				binary: false,
			},
		]);
	});

	it("counts lines of new files the way git does", () => {
		const encode = (text: string) => new TextEncoder().encode(text);
		expect(GitUtils.lines(encode(""))).toBe(0);
		expect(GitUtils.lines(encode("a\nb\n"))).toBe(2);
		expect(GitUtils.lines(encode("a\nb"))).toBe(2);
		expect(GitUtils.lines(new Uint8Array([97, 0, 98]))).toBeNull();
	});
});
