import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type { zConfig, zDataPart } from "../../data/types/message.ts";
import type { Tool, Toolset, zTool } from "../types/tool.ts";

export const ToolUtils = {
	name: ({
		toolset,
		tool,
	}: {
		toolset: Toolset<any>;
		tool?: Tool<any, any, any, any>;
	}) => {
		let name = tool?.name ?? toolset.name;
		if (toolset.prefix === name) return name;
		if (toolset.prefix) {
			name = name.replace(
				new RegExp(`^${CommonUtils.getRegexEscaped(toolset.prefix)}[_-]?`),
				"",
			);
		}
		return `${toolset.prefix ? `${toolset.prefix}_` : ""}${name}`;
	},

	find: ({ toolsets, name }: { toolsets: Toolset<any>[]; name: string }) => {
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
		toolCall,
		isTool,
	}: {
		toolsets: Toolset<any>[];
		toolCall: Extract<zDataPart, { type: "toolCall" }>;
		isTool: zTool | string;
	}) => {
		if (typeof isTool !== "string") isTool = isTool.name;
		const { tool } = ToolUtils.find({ toolsets, name: toolCall.name });
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
