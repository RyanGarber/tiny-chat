import type { ShellCapability } from "../../capability/types/capability.ts";
import { SnippetService } from "../../data/services/SnippetService.ts";
import { FileEditUtils } from "../utils/FileEditUtils.ts";
import { FileUtils } from "../utils/FileUtils.ts";
import { PathUtils } from "../utils/PathUtils.ts";

type FilesystemCapability = Pick<
	ShellCapability,
	"readFile" | "readDir" | "writeFile"
>;

export interface FileOperationResult {
	path: string;
	snippet: string;
}

const EXCLUDED_NAMES = new Set([
	"__macosx",
	".ds_store",
	"thumbs.db",
	".git",
	".gitignore",
	".gitattributes",
	".gitmodules",
	"node_modules",
	"pnpm-lock.yaml",
	"package-lock.json",
	"yarn.lock",
	"bun.lockb",
	"cargo.lock",
	"gemfile.lock",
	"poetry.lock",
	"uv.lock",
	"composer.lock",
	"mix.lock",
	".pnp.cjs",
	".pnp.loader.mjs",
	".yarn",
	"dist",
	"build",
	"out",
	"target",
	"bin",
	"obj",
	".next",
	".nuxt",
	".svelte-kit",
	".output",
	"__pycache__",
	".pytest_cache",
]);

const EXCLUDED_EXTENSIONS = new Set([
	"class",
	"o",
	"so",
	"dll",
	"exe",
	"dylib",
	"pyc",
	"pyo",
	"jar",
	"war",
	"a",
	"lib",
	"map",
	"png",
	"jpg",
	"jpeg",
	"gif",
	"ico",
	"webp",
	"svg",
	"mp3",
	"mp4",
	"wav",
	"mov",
	"ttf",
	"woff",
	"woff2",
	"eot",
	"otf",
	"icns",
	"zip",
	"tar",
	"gz",
	"rar",
	"7z",
	"pdf",
	"docx",
	"xlsx",
]);

const shouldInclude = (path: string) => {
	const parts = PathUtils.split(path).map((part) => part.toLowerCase());
	if (parts.some((part) => EXCLUDED_NAMES.has(part))) return false;

	const name = parts.at(-1) ?? "";
	const extension = name.includes(".") ? name.split(".").at(-1) : undefined;
	return !extension || !EXCLUDED_EXTENSIONS.has(extension);
};

const getFiles = async ({
	shell,
	path,
}: {
	shell: FilesystemCapability;
	path: string;
}) => {
	const files: string[] = [];
	const directories = [path];
	const visited = new Set<string>();
	let isRoot = true;

	while (directories.length) {
		const directory = directories.shift() as string;
		const normalized = PathUtils.normalize({ path: directory, unix: true });
		if (visited.has(normalized)) continue;
		visited.add(normalized);

		let entries: Awaited<ReturnType<FilesystemCapability["readDir"]>>;
		try {
			entries = await shell.readDir({ path: directory });
		} catch (error) {
			if (isRoot) throw error;
			continue;
		}
		isRoot = false;

		for (const entry of entries.sort((a, b) => a.path.localeCompare(b.path))) {
			if (!shouldInclude(entry.path)) continue;
			if (entry.is_dir) directories.push(entry.path);
			else files.push(entry.path);
		}
	}

	return files;
};

const readText = async ({
	shell,
	path,
}: {
	shell: FilesystemCapability;
	path: string;
}) => {
	try {
		const file = await shell.readFile({ path });
		return FileUtils.getTextFromBytes(file);
	} catch {
		return null;
	}
};

export const FileOperationService = {
	searchFiles: async ({
		shell,
		path,
		query,
		maxResults = 10,
	}: {
		shell: FilesystemCapability;
		path: string;
		query: string;
		maxResults?: number;
	}): Promise<FileOperationResult[]> => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) throw new Error("Search query must not be empty.");
		const terms = normalizedQuery.split(/\s+/);
		const results: (FileOperationResult & { score: number })[] = [];

		for (const filePath of await getFiles({ shell, path })) {
			const normalizedPath = PathUtils.normalize({
				path: filePath,
				unix: true,
			}).toLowerCase();
			const pathHits = terms.filter((term) =>
				normalizedPath.includes(term),
			).length;
			const text = await readText({ shell, path: filePath });
			const hits = text
				? SnippetService.getHits({ text, query, baseWindow: 500 })
				: [];
			if (!pathHits && !hits.length) continue;

			results.push({
				path: filePath,
				snippet: text
					? SnippetService.getSnippet({ text, query, baseWindow: 500 })
					: "",
				score:
					(pathHits === terms.length ? 100 : pathHits * 10) +
					hits.reduce((score, hit) => score + hit.score, 0),
			});
		}

		return results
			.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
			.slice(0, maxResults)
			.map(({ path: resultPath, snippet }) => ({
				path: resultPath,
				snippet,
			}));
	},

	grepFiles: async ({
		shell,
		path,
		query,
		maxResults = 10,
	}: {
		shell: FilesystemCapability;
		path: string;
		query: string;
		maxResults?: number;
	}): Promise<FileOperationResult[]> => {
		let pattern: RegExp;
		try {
			pattern = new RegExp(query, "i");
		} catch (error) {
			throw new Error(
				`Invalid regular expression: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		const results: FileOperationResult[] = [];
		for (const filePath of await getFiles({ shell, path })) {
			const text = await readText({ shell, path: filePath });
			if (text === null || !pattern.test(text)) continue;
			results.push({
				path: filePath,
				snippet: SnippetService.getSnippet({ text, query, baseWindow: 500 }),
			});
			if (results.length >= maxResults) break;
		}
		return results;
	},

	editFile: async ({
		shell,
		path,
		old_string,
		new_string,
		replace_all,
	}: {
		shell: FilesystemCapability;
		path: string;
		old_string: string;
		new_string: string;
		replace_all?: boolean;
	}) => {
		const file = await shell.readFile({ path });
		const content = FileUtils.getTextFromBytes(file);
		if (content === null)
			throw new Error(`Cannot read file as text: ${file.path}`);

		const edit = FileEditUtils.apply({
			content,
			old_string,
			new_string,
			replace_all,
		});
		const written = await shell.writeFile({
			path: file.path,
			content: edit.content,
		});
		return {
			path: written.path,
			success: true as const,
			replacements: edit.replacements,
		};
	},
} as const;
