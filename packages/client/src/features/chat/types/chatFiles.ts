/** Lines a file gained and lost against the last commit. */
export interface ChatFileChanges {
	additions: number;
	deletions: number;
}

/** A file or folder the chat has touched, on the mount or on the machine. */
export interface ChatFile {
	path: string;
	directory: boolean;
	/** On the user's machine rather than the chat's mount. */
	local: boolean;
	/** Where it sits in the tree, from its root (`local`, `chat`, `uploads`, …). */
	displayPath: string[];
}

export interface ChatFileNode {
	/** Unique within the tree, and stable across rebuilds. */
	value: string;
	label: string;
	directory: boolean;
	local: boolean;
	/** Set when the node is a file the chat knows about, not a folder implied by one. */
	file?: ChatFile;
	/** Changes under the node, when it sits in a git repository that has any. */
	changes?: ChatFileChanges;
	children: ChatFileNode[];
}

export interface GitChange extends ChatFileChanges {
	/** Absolute, with forward slashes. */
	path: string;
	/** Not yet known to git, so all of it is new. */
	untracked: boolean;
	binary: boolean;
}

export interface GitRepo {
	/** Absolute, with forward slashes, as the chat refers to it. */
	root: string;
	/** Whether the repository has a commit to compare against. */
	head: boolean;
	changes: GitChange[];
}
