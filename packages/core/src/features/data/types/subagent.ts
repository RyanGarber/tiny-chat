import type { Model } from "#core/core/services/PostgresService.ts";

/** A subagent's run, kept under the id of the call that ran it. */
export type SubagentState = Model["Subagent"];
