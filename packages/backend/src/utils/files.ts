import { Prisma } from "../../generated/prisma/client.ts";

const EXCLUDE_FILES = ["__MACOSX/", ".DS_Store", "Thumbs.db"];

export const EXCLUDE_FILES_ADDITIONAL = [
	// 1. Version Control & Git
	".git/",
	".gitignore",
	".gitattributes",
	".gitmodules",

	// 2. Package Managers & Lockfiles
	"node_modules/",
	"pnpm-lock.yaml",
	"package-lock.json",
	"yarn.lock",
	"bun.lockb",
	"Cargo.lock",
	"Gemfile.lock",
	"poetry.lock",
	"uv.lock",
	"composer.lock",
	"mix.lock",
	".pnp.cjs",
	".pnp.loader.mjs",
	".yarn/",

	// 3. Build Outputs, Framework Dirs & Compiled Code
	"dist/",
	"build/",
	"out/",
	"target/",
	"bin/",
	"obj/",
	".next/",
	".nuxt/",
	".svelte-kit/",
	".output/",
	"__pycache__/",
	".pytest_cache/",

	// 4. Compiled Binaries & Bytecode
	".class",
	".o",
	".so",
	".dll",
	".exe",
	".dylib",
	".pyc",
	".pyo",
	".jar",
	".war",
	".a",
	".lib",

	// 5. Minified & Bundled Frontend Assets
	".min.js",
	".min.css",
	".bundle.js",
	".bundle.css",
	".map", // Source maps (massive JSON)

	// 6. Media, Fonts & Binary Assets
	".png",
	".jpg",
	".jpeg",
	".gif",
	".ico",
	".webp",
	".svg", // Optional to ignore, but usually too noisy for LLMs
	".mp3",
	".mp4",
	".wav",
	".mov",
	".ttf",
	".woff",
	".woff2",
	".eot",
	".otf",
	".icns",

	// 7. Archives & Documents
	".zip",
	".tar",
	".gz",
	".rar",
	".7z",
	".pdf",
	".docx",
	".xlsx",

	// 8. Logs, Databases & Data Dumps
	".log",
	".sqlite",
	".sqlite3",
	".db",
	".rdb",
	".csv",
	".tsv",
	".jsonl",

	// 9. IDE & Environment Configs
	".env",
	".env.local",
	".env.development",
	".env.production",
	".idea/",
	".vscode/",
	".vs/",
	".suo",
	".sln",

	// 10. Testing & Coverage
	"coverage/",
	".nyc_output/",
	"playwright-report/",
	"test-results/",

	// 11. Unity
	"Library/",
	"Temp/",
	"Obj/",
	"Build/",
	"Builds/",
	"Photon/",
	"packages-lock.json",
	".meta",
	".mixer",
	".settings",
	".unity",
	".prefab",
	".asset",
	".controller",
	".fbx",
	".obj",
	".shader",
	".mat",
	".chm",
	".unitypackage",
];

export function shouldIncludeFile(
	path: string,
	excludeAdditional = true,
): boolean {
	const paths = [
		...EXCLUDE_FILES,
		...(excludeAdditional ? EXCLUDE_FILES_ADDITIONAL : []),
	].map((path) => path.replace(/\/$/, ""));
	return !paths.some(
		(match) => `/${path}`.includes(`/${match}/`) || path.endsWith(match),
	);
}

export function shouldIncludeFileSql(excludeAdditional = true): Prisma.Sql {
	const paths = [
		...EXCLUDE_FILES,
		...(excludeAdditional ? EXCLUDE_FILES_ADDITIONAL : []),
	].map((path) => path.replace(/\/$/, ""));
	const sql = Prisma.sql`
    CONCAT('/', array_to_string(path, '/')) NOT ILIKE ALL(ARRAY[${Prisma.join(paths.map((path) => `%/${path}/%`))}])
    AND array_to_string(path, '/') NOT ILIKE ALL(ARRAY[${Prisma.join(paths.map((path) => `%${path}`))}])
  `;
	return sql;
}
