import type { zAgentContext } from "../../features/agent/types/agent.ts";
import type { ActionState } from "../../features/data/types/action.ts";
import type {
	MemoryCategory,
	MemorySearchResult,
	MemoryStability,
	MemoryState,
} from "../../features/data/types/memory.ts";
import type {
	MessageLike,
	MessageSearchResult,
	zConfig,
	zData,
} from "../../features/data/types/message.ts";
import type { FileNode } from "../../features/file/types/file.ts";
import type { zWebContext } from "../../features/provider/types/web.ts";

export interface WebCapability {
	search: (_: { query: string; maxResults: number }) => Promise<zWebContext[]>;

	view: (_: { url: string }) => Promise<zWebContext>;
}

export interface EmbeddingCapability {
	getEmbedding: (_: { message: MessageLike }) => Promise<number[] | null>;

	runEmbedding: (_: { text: string }) => Promise<number[]>;
}

export interface SubagentsCapability {
	runSubagent: (_: {
		context: zAgentContext;
		config: zConfig;
		onData: (data: zData) => void;
		abort?: AbortSignal;
	}) => Promise<zData>;
}

export interface UserCapability {
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

	searchMemories: (_: {
		searchText: string;
		searchEmbedding?: number[];
	}) => Promise<MemorySearchResult[]>;

	createMemory: (_: {
		fact: string;
		category: MemoryCategory;
		stability: MemoryStability;
		evidence: string[];
		confidence: number;
	}) => Promise<MemoryState>;

	updateMemory: (_: {
		id: string;
		fact: string;
		category: MemoryCategory;
		stability: MemoryStability;
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

	writeFile: (_: {
		path: string;
		content: string;
	}) => Promise<{ path: string; success: true }>;

	/**
	 * `onOutput` is called with output as it arrives, for shells that can
	 * report it. The resolved value always carries the complete output, so a
	 * shell that cannot stream simply never calls it.
	 */
	exec: (_: {
		command: string;
		stream?: (_: { type: "stdout" | "stderr"; value: string }) => void;
	}) => Promise<{ code?: number; stdout: string; stderr: string }>;

	nodes?: () => Promise<FileNode[]>;
}

export interface Capabilities {
	web?: WebCapability;
	embedding?: EmbeddingCapability;
	subagent?: SubagentsCapability;
	user?: UserCapability;
	chatShell?: ShellCapability;
	shell?: ShellCapability;
}

export type CapabilityFactory<T, TCapability> = (
	props: T,
) => Promise<TCapability>;
