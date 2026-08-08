import type { File } from "../../../../../server/generated/prisma/browser.ts";

export type FileState = File & {
	uri: string;
};

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
