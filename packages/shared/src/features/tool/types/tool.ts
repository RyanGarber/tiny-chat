/** biome-ignore-all lint/suspicious/noConfusingVoidType: no input expected */

import { z } from "zod";
import type { zAgentContext } from "../../agent/types/agent.ts";
import type { Capabilities } from "../../capability/types/capability.ts";
import type { zToolDataPart } from "../../data/types/message.ts";

export const zTool = z.object({
	name: z.string(),
	description: z.string(),

	input: z.unknown(),
	output: z.unknown(),
	feedback: z.unknown().optional(),
});
export type zTool = z.infer<typeof zTool>;

export interface Tool<
	TInput extends z.ZodType,
	TFeedback extends z.ZodType | void,
	TOutput extends z.ZodType,
	TCapabilities extends Record<string, Capabilities[keyof Capabilities]> | void,
> extends zTool {
	input: TInput;
	approval?: boolean;
	feedback?: TFeedback;
	output: TOutput;

	execute: (_: {
		input: z.infer<TInput>;
		feedback: z.infer<TFeedback>;
		context: zAgentContext;
		capabilities: TCapabilities;
	}) => Promise<
		(
			| Exclude<zToolDataPart, { type: "json" }>
			| { type: "json"; value: z.infer<TOutput> }
		)[]
	>;
}

export const zToolset = z.object({
	name: z.string(),
	instructions: z.string().optional(),
	prefix: z.string().optional(),

	tools: z.array(zTool),
});
export type zToolset = z.infer<typeof zToolset>;

export interface ToolsetStatus {
	valid: boolean;
	error?: unknown;
}

export interface Toolset<
	TCapabilities extends Record<string, Capabilities[keyof Capabilities]> | void,
> extends zToolset {
	tools: Tool<any, any, any, TCapabilities>[];
	capabilities: TCapabilities;
	status: ToolsetStatus;
}

export type ToolsetFactory<
	TCapabilities extends Record<string, Capabilities[keyof Capabilities]> | void,
> = (options: {
	prefix?: string;
	instructions?: string;
	capabilities: TCapabilities;
	status: ToolsetStatus;
}) => Toolset<TCapabilities> | Promise<Toolset<TCapabilities>>;
