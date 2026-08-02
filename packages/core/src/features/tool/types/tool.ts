/** biome-ignore-all lint/suspicious/noConfusingVoidType: no input expected */

import type { z } from "zod";
import type { zAgentContext } from "../../agent/types/agent.ts";
import type { Capabilities } from "../../capability/types/capability.ts";
import type { zDataInnerPart } from "../../data/types/message.ts";

export interface ToolDefinition {
	name: string;
	description: string;
	input: z.ZodType;
	feedback?: z.ZodType | void;
	output: z.ZodType;
}

export interface Tool<
	TDefinition extends ToolDefinition,
	TCapabilities extends Record<string, Capabilities[keyof Capabilities]> | void,
> extends ToolDefinition {
	prefix?: string;

	capabilities: TCapabilities;
	approval?: boolean;

	input: TDefinition["input"];
	feedback?: TDefinition["feedback"];
	output: TDefinition["output"];

	execute: (_: {
		input: z.infer<TDefinition["input"]>;
		feedback: z.infer<TDefinition["feedback"]>;
		context: zAgentContext;
	}) => Promise<
		(
			| Exclude<zDataInnerPart, { type: "json" }>
			| { type: "json"; value: z.infer<TDefinition["output"]> }
		)[]
	>;
}

export type ToolFactory<T extends Tool<any, any>> = (options: {
	prefix?: string;
	approval?: boolean;
	capabilities: T["capabilities"];
}) => T | Promise<T>;

export interface ToolsetStatus {
	valid: boolean;
	error?: unknown;
}

export interface Toolset<
	TCapabilities extends Record<string, Capabilities[keyof Capabilities]> | void,
> {
	name: string;
	instructions?: string;
	prefix?: string;
	tools: Tool<any, TCapabilities>[];
	capabilities: TCapabilities;
	status: ToolsetStatus;
}

export type ToolsetFactory<T extends Toolset<any>> = (options: {
	prefix?: string;
	instructions?: string;
	approval?: boolean;
	capabilities: T["capabilities"];
	status: ToolsetStatus;
}) => T | Promise<T>;
