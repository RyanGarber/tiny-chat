import type { z } from "zod";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type {
	zConfig,
	zDataBasicPart,
	zDataPart,
} from "../../data/types/message.ts";
import type { RenderedPart } from "../../data/utils/DataUtils.ts";
import type { Tool, ToolDefinition, Toolset } from "../types/tool.ts";

export type ToolCall<T extends ToolDefinition> = Omit<
	Extract<zDataPart, { type: "toolCall" }>,
	"name" | "args"
> & { name: T["name"]; args: z.infer<T["input"]> };

export type ToolResult<T extends ToolDefinition> = Omit<
	Extract<zDataPart, { type: "toolResult" }>,
	"name" | "value"
> & {
	name: T["name"];
	value: T["output"] extends z.ZodNever
		? never
		: (
				| Exclude<zDataBasicPart, { type: "json" }>
				| { type: "json"; value: z.infer<T["output"]> }
			)[];
};

/**
 * Resolved-name lookup per `toolsets` array identity.
 *
 * `find` used to rescan every toolset and rebuild a `RegExp` per tool on each
 * call, and `ToolCallUtils.getDetails` calls it once per `is()` branch — over
 * twenty full scans for a single tool call. Indexing once per toolset list
 * turns that into a map lookup. Keyed weakly so a replaced list is collected.
 */
const indexes = new WeakMap<
	Toolset<any>[],
	Map<string, { toolset: Toolset<any>; tool: Tool<any, any> }>
>();

const getIndex = (toolsets: Toolset<any>[]) => {
	let index = indexes.get(toolsets);
	if (index) return index;

	index = new Map();
	for (const toolset of toolsets) {
		for (const tool of toolset.tools) {
			// First match wins, matching the original scan order.
			const name = ToolUtils.name({ toolset, tool });
			if (!index.has(name)) index.set(name, { toolset, tool });
		}
	}

	indexes.set(toolsets, index);
	return index;
};

export const ToolUtils = {
	name: ({
		toolset,
		tool,
	}: {
		toolset: Toolset<any>;
		tool?: Tool<any, any>;
	}) => {
		const prefix = tool?.prefix ?? toolset.prefix;
		let name = tool?.name ?? toolset.name;
		if (prefix === name) return name;
		if (prefix) {
			name = name.replace(
				new RegExp(`^${CommonUtils.escapeRegex(prefix)}[_-]?`),
				"",
			);
		}
		return `${prefix ? `${prefix}_` : ""}${name}`;
	},

	find: ({
		toolsets,
		name,
		part,
	}: {
		toolsets: Toolset<any>[];
		name?: string;
		part?: Extract<zDataPart, { type: "toolCall" | "toolResult" }>;
	}) => {
		name ??= part?.name;
		if (name === undefined) return { toolset: null, tool: null };

		return getIndex(toolsets).get(name) ?? { toolset: null, tool: null };
	},

	checkOne: ({
		toolset,
		config,
	}: {
		toolset: Toolset<any>;
		config: zConfig;
	}) => {
		return (
			toolset.status.valid &&
			config.toolsets?.includes(ToolUtils.name({ toolset }))
		);
	},

	checkAll: ({
		toolsets: _toolsets,
		config,
	}: {
		toolsets: Toolset<any>[];
		config: zConfig;
	}) => {
		const toolsets = _toolsets.filter((toolset) =>
			ToolUtils.checkOne({ toolset, config }),
		);
		const tools = toolsets.flatMap((toolset) => toolset.tools);
		return { toolsets, tools };
	},

	is: <T extends ToolDefinition>(
		toolsets: Toolset<any>[],
		part: Extract<RenderedPart, { type: "toolCall" }>,
		isTool: T,
	): part is ToolCall<T> & { result: ToolResult<T> } => {
		const { tool } = ToolUtils.find({ toolsets, part });
		return tool?.name === isTool.name;
	},

	json: <T extends ToolDefinition>(
		value?:
			| Extract<zDataPart, { type: "toolResult" }>
			| Extract<zDataPart, { type: "toolResult" }>["value"],
		multiple?: boolean,
	): z.infer<T["output"]>[] => {
		if (!value) return [];
		if (!Array.isArray(value)) value = value.value;
		let json = value
			.filter((part) => part.type === "json")
			.map(({ value }) => value);
		if (multiple && Array.isArray(json[0])) json = json.flat();
		return json as z.infer<T["output"]>[];
	},

	file: (
		value?:
			| Extract<zDataPart, { type: "toolResult" }>
			| Extract<zDataPart, { type: "toolResult" }>["value"],
		multiple?: boolean,
	): Extract<zDataBasicPart, { type: "file" }>[] => {
		if (!value) return [];
		if (!Array.isArray(value)) value = value.value;
		let file = value.filter((part) => part.type === "file");
		if (multiple && Array.isArray(file[0])) file = file.flat();
		return file as Extract<zDataBasicPart, { type: "file" }>[];
	},
} as const;
