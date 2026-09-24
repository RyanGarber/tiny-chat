import type { zAgentContext } from "../../agent/types/agent.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";

const normalizeAbsolutePath = (path: string): string | null => {
	const normalized = PathUtils.normalize({ path, unix: true });
	const drive = /^[A-Za-z]:\//.exec(normalized)?.[0];
	const root = drive ?? (normalized.startsWith("/") ? "/" : null);
	if (!root) return null;

	const parts: string[] = [];
	for (const part of normalized.slice(root.length).split("/")) {
		if (!part || part === ".") continue;
		if (part === "..") {
			if (!parts.length) return null;
			parts.pop();
			continue;
		}
		parts.push(part);
	}

	return `${root}${parts.join("/")}`.replace(/\/$/, "") || "/";
};

export const FileToolUtils = {
	requiresApproval: ({
		path,
		context,
	}: {
		path: string;
		context: zAgentContext;
	}): boolean => {
		const folderPath = context.chat?.folder?.cwd;
		if (!folderPath || !context.chat?.folder?.cwdWritable) return true;

		const folder = normalizeAbsolutePath(folderPath);
		const target = normalizeAbsolutePath(path);
		if (!folder || !target) return true;

		const windows = /^[A-Za-z]:/.test(folder) && /^[A-Za-z]:/.test(target);
		const comparableFolder = windows ? folder.toLowerCase() : folder;
		const comparableTarget = windows ? target.toLowerCase() : target;
		if (comparableTarget === comparableFolder) return false;
		if (comparableFolder === "/") return false;

		return !comparableTarget.startsWith(`${comparableFolder}/`);
	},
} as const;
