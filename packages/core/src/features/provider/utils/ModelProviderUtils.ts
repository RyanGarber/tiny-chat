import type { zConfig, zDataPart } from "../../data/types/message.ts";
import { FileUtils } from "../../file/utils/FileUtils.ts";
import type { ModelProvider, zModelArg } from "../types/model.ts";

export const ModelProviderUtils = {
	isModel: (model: string, ...groups: string[]) => {
		model = model.replace(/[+_.:]/g, "-");
		groups = groups.map((group) => group.replace(/[+_.:]/g, "-"));
		return groups.some((group) =>
			group
				.split(" ")
				.every((match) =>
					new RegExp(`(?:^|\\W)(${match})(?:\\W|$)`, "i").test(model),
				),
		);
	},

	getModelArgs: ({ maxTemp = 2 }: { maxTemp?: number }) => {
		const args: zModelArg[] = [
			{
				type: "range",
				name: "tokens-in",
				min: 1_000,
				max: 1_000_000,
				default: 100_000,
			},
			{
				type: "range",
				name: "tokens-out",
				min: 1_000,
				max: 250_000,
				default: 25_000,
			},
		];
		if (maxTemp > 0) {
			args.push({
				type: "range",
				name: "temperature",
				min: 0,
				max: maxTemp,
				default: 1,
			});
		}
		return args;
	},

	getPartTransformed: ({
		part,
		supportedFileTypes = [],
	}: {
		part: zDataPart;
		supportedFileTypes?: string[];
	}): zDataPart => {
		if (part.type === "file") {
			if (!supportedFileTypes.some((m) => part.mime.startsWith(m))) {
				const text = FileUtils.getTextFromBytes(part);
				if (text) return { type: "text", value: text };
				return { type: "text", value: `[Unsupported file: ${part.data}]` };
			}
		}
		return part;
	},

	getConfigDefaults: ({
		config,
		args,
	}: {
		config: zConfig;
		args: zModelArg[];
	}) => {
		console.log("[ModelProviderUtils] model args:", args);
		const inputArgs = (config.args ?? {}) as Record<string, unknown>;
		for (const arg of args) {
			if (inputArgs?.[arg.name] === undefined) {
				console.log(
					`[ModelProviderUtils] using default ${arg.default} for arg ${arg.name}`,
				);
				if (config.args === undefined) config.args = {};
				inputArgs[arg.name] = arg.default;
			}
		}
		config.args = inputArgs;
		return config;
	},

	getSignaturePruned: (
		signature: ReturnType<NonNullable<ModelProvider<any>["getPartSignature"]>>,
	) => {
		if (!signature) return undefined;
		for (const [k, v] of Object.entries(signature)) {
			if (k !== "model" && v !== undefined) return signature;
		}
		return undefined;
	},

	getSignatureReturnPruned: (
		signatureReturn: ReturnType<
			NonNullable<ModelProvider<any>["getPartSignatureReturn"]>
		>,
	) => {
		if (!signatureReturn) return undefined;
		const cleaned: Record<string, any> = {};
		for (const [k, p] of Object.entries(signatureReturn)) {
			if (
				Object.entries(p as Record<string, any>).some(
					([_, v]) => v !== undefined,
				)
			)
				cleaned[k] = p;
		}
		return Object.entries(cleaned).length ? cleaned : undefined;
	},
} as const;
