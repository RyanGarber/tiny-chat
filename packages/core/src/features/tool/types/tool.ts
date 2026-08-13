/** biome-ignore-all lint/suspicious/noConfusingVoidType: no input expected */

import type { z } from "zod";
import type { zAgentContext } from "../../agent/types/agent.ts";
import type {
	Capabilities,
	ShellOutputHandler,
} from "../../capability/types/capability.ts";
import type { zDataBasicPart } from "../../data/types/message.ts";

export interface ToolDefinition {
	name: string;
	description: string;
	input: z.ZodTypeAny;
	feedback?: z.ZodTypeAny | void;
	output: z.ZodTypeAny;
}

export interface ToolValidation {
	approval?: boolean;
}

export interface Tool<
	TDefinition extends ToolDefinition,
	TCapabilities extends Record<string, Capabilities[keyof Capabilities]> | void,
> extends ToolDefinition {
	prefix?: string;
	capabilities: TCapabilities;

	input: TDefinition["input"];
	feedback?: TDefinition["feedback"];
	output: TDefinition["output"];

	/**
	 * Runs before `execute`, and before the loop stops for approval or feedback.
	 * Throw to fail the call outright: the error becomes the tool result and the
	 * model gets to correct itself, rather than the user being asked to approve
	 * a call that was never going to work.
	 */
	validate?: (_: {
		input: z.infer<TDefinition["input"]>;
		context: zAgentContext;
	}) => Promise<ToolValidation | undefined>;

	/**
	 * `onOutput` lets a long-running tool report output before it finishes, so
	 * the UI can show it live. Whatever is reported this way still has to appear
	 * in the resolved result: nothing streamed is persisted.
	 */
	execute: (_: {
		input: z.infer<TDefinition["input"]>;
		feedback: z.infer<TDefinition["feedback"]>;
		context: zAgentContext;
		onOutput?: ShellOutputHandler;
	}) => Promise<
		(
			| Exclude<zDataBasicPart, { type: "json" }>
			| { type: "json"; value: z.infer<TDefinition["output"]> }
		)[]
	>;
}

export type ToolFactory<T extends Tool<any, any>> = (options: {
	prefix?: string;
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
	capabilities: T["capabilities"];
	status: ToolsetStatus;
}) => T | Promise<T>;
