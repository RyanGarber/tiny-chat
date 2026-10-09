import "../src/env.ts";

import { fileURLToPath } from "node:url";
import * as Babel from "@babel/core";
import chalk from "chalk";
import { zEnv } from "#core/core/types/env.ts";
import { create, print } from "../../../scripts/use-stdout.ts";
import { buildAfmize } from "./afmize.ts";
import { buildComputer } from "./computer.ts";

export const environment = Object.fromEntries(
	Object.entries(zEnv.parse(process.env)).map(([key, value]) => [
		`process.env.${key}`,
		JSON.stringify(value),
	]),
);

type BuildOutput = Awaited<ReturnType<typeof Bun.build>>;
type PluginConfig = NonNullable<
	NonNullable<
		NonNullable<Parameters<typeof Babel.transformAsync>[1]>["parserOpts"]
	>["plugins"]
>[number];

type BuildResult = Omit<BuildOutput, "logs"> & {
	logs: (BuildOutput["logs"][number] | { error: unknown })[];
};

/** The stub `AFMLibrary.ts` that `afmize` stands in for once it is built. */
const AFM_LIBRARY = fileURLToPath(
	new URL("../src/core/services/AFMLibrary.ts", import.meta.url),
);

/** The stub `ComputerLibrary.ts` that lib/computer stands in for once built. */
const COMPUTER_LIBRARY = fileURLToPath(
	new URL("../src/core/services/ComputerLibrary.ts", import.meta.url),
);

/**
 * Replaces a stub module with one that embeds `library` as a file: in a
 * compiled binary, Bun extracts it for `dlopen`; in `dist/`, it is copied
 * beside the bundle.
 */
const embed = (
	name: string,
	stub: string,
	library: string | null,
): Bun.BunPlugin => ({
	name,
	setup: (build) => {
		if (!library) return;
		const file = stub.split(/[\\/]/).at(-1)?.replace(/\./g, "\\.");
		build.onLoad({ filter: new RegExp(`[\\\\/]${file}$`) }, (args) =>
			args.path === stub
				? {
						contents: `import library from ${JSON.stringify(library)} with { type: "file" };\nexport default library;`,
						loader: "ts",
					}
				: undefined,
		);
	},
});

export async function compile({
	dev = false,
	...options
}: Partial<Parameters<typeof Bun.build>[0]> & {
	dev?: boolean;
} = {}): Promise<BuildResult | null> {
	const profile = dev ? "debug" : "release";
	const [afmize, computer] = await Promise.all([
		buildAfmize(profile),
		buildComputer(profile),
	]);

	const define = Object.fromEntries(
		Object.entries(environment).flatMap(([key, value]) => {
			if (key === "process.env.DEV") {
				return dev ? [] : [["process.env.DEV", ""]];
			}
			return [[key, value]];
		}),
	);
	print({
		message: `environment${dev ? " · dev" : ""}`,
		details: Object.keys(define).join(", "),
		level: "verbose",
	});

	const update = create("compiling");

	let result: BuildResult | null = null;

	try {
		result = await Bun.build({
			// the highlight worker is its own entrypoint so Shiki stays out of the
			// main bundle; `client.ts` starts it from beside `index`
			entrypoints: ["./src/index.ts", "./src/highlight.ts"],
			banner: "globalThis.UPNG = undefined;",
			plugins: [
				embed("afmize", AFM_LIBRARY, afmize),
				embed("computer", COMPUTER_LIBRARY, computer),
				{
					name: "react-compiler",
					setup: (build) => {
						build.onLoad({ filter: /\.jsx?$|\.tsx?$/ }, async (args) => {
							if (args.path.includes("node_modules")) return;

							const source = await Bun.file(args.path).text();
							const extension = args.path.split(".").at(-1) ?? "";

							const plugins: PluginConfig[] = [];
							if (extension.startsWith("t")) plugins.push("typescript");
							if (extension.endsWith("x")) plugins.push("jsx");

							const result = await Babel.transformAsync(source, {
								filename: args.path,
								babelrc: false,
								configFile: false,
								parserOpts: { plugins },
								generatorOpts: { retainLines: false },
								plugins: [["babel-plugin-react-compiler", { target: "19" }]],
							});
							return { contents: result?.code ?? source };
						});
					},
				},
			],
			define,
			...options,
		});
	} catch (error) {
		result = {
			success: false,
			logs: [{ error }],
			outputs: [],
		};
	} finally {
		update(
			result?.success ? "compiled" : "failed to compile",
			!result?.success ? "error" : undefined,
		);
		if (result) {
			print({
				details: result.outputs.map(
					(output) =>
						`${output.path.split("/").at(-1)} ${chalk.gray(`@ ${(output.size / 1024 / 1024).toFixed(1)} MB`)}`,
				),
			});
		}
		for (const log of result?.logs ?? []) {
			if ("error" in log) {
				print({ details: log.error });
			} else {
				print(log);
			}
		}
	}

	return result;
}
