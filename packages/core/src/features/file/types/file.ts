import type { File } from "../../../../../server/generated/prisma/browser.ts";
import type { FileMount } from "../utils/PathUtils.ts";

export type FileState = File & {
	uri: string;
};

/**
 * What a mount is built from: the uploads and skills something points into,
 * and the chat that holds what the model writes. All of it is optional — a
 * message still being typed has attachments to read and nowhere to write them.
 */
export interface FilesystemSpec {
	chat?: string | null;
	uploads?: string[];
	skills?: string[];
}

/**
 * A file, or a directory standing above one, as the mount shows it.
 *
 * There is only ever one file at a path now: an upload and a skill are read
 * only, and everything a chat writes lives in its own tree, so nothing shadows
 * anything else and a node is just what is there.
 */
export interface FileNode {
	uri: string;
	/** The whole path below the mount root, tree and id included. */
	path: string[];
	/** Which of the mount's trees the file is in; null at the mount's root. */
	mount: FileMount | null;
	/** The upload, skill or chat the tree is named for, if it is below one. */
	id: string | null;
	/** The stored file this stands for; absent for a directory. */
	file: string | null;
	/** What that upload, skill or chat is called, when it is called anything. */
	name: string | null;
	isDirectory: boolean;
	lines: number;
	createdAt: Date;
}
