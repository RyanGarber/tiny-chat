import type { zAgentContext } from "../../features/agent/types/agent.ts";
import type { ActionState } from "../../features/data/types/action.ts";
import type {
	MemorySearchResult,
	MemorySource,
	MemoryState,
} from "../../features/data/types/memory.ts";
import type {
	MessageLike,
	MessageSearchResult,
} from "../../features/data/types/message.ts";
import type { zData } from "../../features/data/types/part.ts";
import type { FileNode } from "../../features/file/types/file.ts";
import type { zWebContext } from "../../features/provider/types/web.ts";
import type {
	zBrowserRunResult,
	zBrowserStatus,
	zBrowserStep,
} from "../../features/tool/types/browser.ts";
import type { Enum } from "../services/PostgresService.ts";

export interface WebCapability {
	search: (_: { query: string; maxResults: number }) => Promise<zWebContext[]>;

	view: (_: { url: string }) => Promise<zWebContext>;
}

export interface GitHubCapability {
	request: (_: {
		path: string;
		query?: Record<string, string | number | boolean | undefined>;
	}) => Promise<unknown>;
}

export interface EmbeddingCapability {
	getEmbedding: (_: { message: MessageLike }) => Promise<number[] | null>;

	runEmbedding: (_: { text: string }) => Promise<number[]>;
}

export interface SubagentsCapability {
	runSubagent: (_: {
		context: zAgentContext;
		instructions?: string;
		onData: (data: zData) => void;
		abort?: AbortSignal;
	}) => Promise<zData>;
}

export interface ActionsCapability {
	getActions: () => Promise<ActionState[]>;

	createAction: (_: {
		data: zData;
		schedule: string;
		timezone: string;
	}) => Promise<ActionState>;

	updateAction: (_: {
		id: string;
		data: zData;
		schedule: string;
		timezone: string;
	}) => Promise<ActionState>;

	deleteAction: (_: { id: string }) => Promise<ActionState>;
}

export interface MemoriesCapability {
	retrieveMemories: (_: {
		messages: MemorySource[];
		tokens: number;
	}) => Promise<MemorySearchResult[][]>;

	searchMemories: (_: {
		searchText: string;
		searchEmbedding?: number[];
	}) => Promise<MemorySearchResult[]>;

	createMemory: (_: {
		fact: string;
		category: Enum["MemoryCategory"];
		stability: Enum["MemoryStability"];
		evidence: string[];
		confidence: number;
	}) => Promise<MemoryState>;

	updateMemory: (_: {
		id: string;
		fact: string;
		category: Enum["MemoryCategory"];
		stability: Enum["MemoryStability"];
		evidence: string[];
		confidence: number;
	}) => Promise<MemoryState>;

	deleteMemory: (_: { id: string }) => Promise<MemoryState>;

	searchChats: (_: {
		searchText: string;
		searchEmbedding?: number[];
	}) => Promise<MessageSearchResult[]>;
}

export interface ShellCapability {
	cwd?: () => Promise<string>;

	chdir?: (_: { path: string }) => Promise<void>;

	readFile: (_: {
		path: string;
	}) => Promise<{ path: string; data: Uint8Array }>;

	readDir: (_: {
		path: string;
	}) => Promise<{ path: string; is_dir: boolean }[]>;

	/**
	 * Breadth-first listing of everything under `path`, for shells that can do
	 * it natively — one call instead of one `readDir` per directory. Each
	 * directory's entries are sorted by path. A directory whose lower-cased name
	 * is in `prune`, or that sits deeper than `maxDepth`, is reported but not
	 * descended into. Deciding what a caller should see is not this method's
	 * job: `FileSearchService.walk` filters what it returns, and falls back to
	 * `readDir` for shells without it.
	 *
	 * `root` is `path` as the shell resolved it, which every entry sits under.
	 */
	walk?: (_: {
		path: string;
		maxDepth: number;
		maxEntries: number;
		prune: string[];
	}) => Promise<{
		root: string;
		entries: { path: string; is_dir: boolean }[];
		truncated: boolean;
	}>;

	writeFile: (_: {
		path: string;
		content: string;
	}) => Promise<{ path: string; success: true }>;

	/**
	 * `onOutput` is called with output as it arrives, for shells that can
	 * report it. The resolved value always carries the complete output, so a
	 * shell that cannot stream simply never calls it.
	 *
	 * `abort` kills the command and everything it started; the call then
	 * resolves with whatever output it had. Output is kept bounded (head and
	 * tail) by the shell, since a command like `find /` never stops writing.
	 */
	exec: (_: {
		command: string;
		stream?: (_: { type: "stdout" | "stderr"; value: string }) => void;
		abort?: AbortSignal;
	}) => Promise<{ code?: number; stdout: string; stderr: string }>;

	nodes?: () => Promise<FileNode[]>;
}

/**
 * A real browser on the user's machine, driven through Playwright. The page and
 * its state outlive a call, so one run can pick up where the last left off.
 */
export interface BrowserCapability {
	status: () => Promise<zBrowserStatus>;

	/**
	 * Runs steps in order against the active tab, stopping at the first that
	 * fails. `screenshot` adds one of the viewport once they are done.
	 */
	run: (_: {
		steps: zBrowserStep[];
		screenshot?: boolean;
		abort?: AbortSignal;
	}) => Promise<zBrowserRunResult>;
}

export interface Capabilities {
	web?: WebCapability;
	github?: GitHubCapability;
	embedding?: EmbeddingCapability;
	subagents?: SubagentsCapability;
	actions?: ActionsCapability;
	memories?: MemoriesCapability;
	chatShell?: ShellCapability;
	shell?: ShellCapability;
	browser?: BrowserCapability;
}

export type CapabilityFactory<T, TCapability> = (
	props: T,
) => Promise<TCapability>;
