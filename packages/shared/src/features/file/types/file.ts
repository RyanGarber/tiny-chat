import type { File } from "../../../../../backend/generated/prisma/browser.ts";

export type FileState = File & {
	uri: string;
};

export type FileSearchResult = Pick<
	FileState,
	"id" | "chatId" | "uploadId" | "path" | "data" | "uri"
>;

interface FileNodeItem {
	id: string;
	lines: number;
}

export interface FileNode {
	uri: string;
	path: string[];
	createdAt: Date;
	isDirectory: boolean;
	chatFile: FileNodeItem | null;
	uploadFile: FileNodeItem | null;
	uploadId: string | null;
	uploadName: string | null;
}
