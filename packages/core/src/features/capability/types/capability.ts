import type { FileNode } from "../../../features/file/types/file.ts";
import type { ActionState } from "../../data/types/action.ts";
import type {
	MemoryCategory,
	MemorySearchResult,
	MemoryStability,
	MemoryState,
} from "../../data/types/memory.ts";
import type {
	MessageLike,
	MessageSearchResult,
	zData,
} from "../../data/types/message.ts";
import type { zWebContext } from "../../provider/types/web.ts";

export interface WebCapability {
	search: (_: { query: string; maxResults?: number }) => Promise<zWebContext[]>;

	view: (_: { url: string }) => Promise<zWebContext>;
}

export interface EmbeddingCapability {
	getEmbedding: (_: { message: MessageLike }) => Promise<number[] | null>;

	runEmbedding: (_: { text: string }) => Promise<number[]>;
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
	getFiles?: () => Promise<FileNode[]>;

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

	exec: (_: {
		command: string;
	}) => Promise<{ code?: number; stdout: string; stderr: string }>;
}

export interface Capabilities {
	web?: WebCapability;
	embedding?: EmbeddingCapability;
	user?: UserCapability;
	chatShell?: ShellCapability;
	shell?: ShellCapability;
}

export type CapabilityFactory<T, TCapability> = (
	props: T,
) => Promise<TCapability>;
