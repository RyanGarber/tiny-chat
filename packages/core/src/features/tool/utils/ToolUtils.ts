import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type { zConfig, zDataPart } from "../../data/types/message.ts";
import type { Tool, ToolDefinition, Toolset } from "../types/tool.ts";

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
				new RegExp(`^${CommonUtils.getRegexEscaped(prefix)}[_-]?`),
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

		const toolset = toolsets.find((toolset) =>
			toolset.tools.some((tool) => ToolUtils.name({ toolset, tool }) === name),
		);
		if (!toolset) return { toolset: null, tool: null };
		const tool = toolset.tools.find(
			(tool) => ToolUtils.name({ toolset, tool }) === name,
		);
		if (!tool) return { toolset: null, tool: null };
		return { toolset, tool };
	},

	is: ({
		toolsets,
		part,
		isTool,
	}: {
		toolsets: Toolset<any>[];
		part: Extract<zDataPart, { type: "toolCall" | "toolResult" }>;
		isTool: ToolDefinition | string;
	}) => {
		if (typeof isTool !== "string") isTool = isTool.name;
		const { tool } = ToolUtils.find({ toolsets, part });
		return tool?.name === isTool;
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
} as const;
