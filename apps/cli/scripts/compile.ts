import "../src/env.ts";

import * as Babel from "@babel/core";
import { zEnv } from "@tiny-chat/core/src/core/types/env.ts";
import chalk from "chalk";
import { create, print } from "../../../scripts/use-stdout.ts";

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

export async function compile({
	dev = false,
	...options
}: Partial<Parameters<typeof Bun.build>[0]> & {
	dev?: boolean;
} = {}): Promise<BuildResult | null> {
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
			entrypoints: ["./src/index.ts"],
			plugins: [
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
