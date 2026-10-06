import { SettingsUtils } from "#core/core/utils/SettingsUtils.ts";
import type { zAgentContext } from "#core/features/agent/types/agent.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";

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

const contains = (folderPath: string, path: string): boolean => {
	const folder = normalizeAbsolutePath(folderPath);
	const target = normalizeAbsolutePath(path);
	if (!folder || !target) return false;

	const windows = /^[A-Za-z]:/.test(folder) && /^[A-Za-z]:/.test(target);
	const comparableFolder = windows ? folder.toLowerCase() : folder;
	const comparableTarget = windows ? target.toLowerCase() : target;
	if (comparableTarget === comparableFolder) return true;
	if (comparableFolder === "/") return true;

	return comparableTarget.startsWith(`${comparableFolder}/`);
};

export const FileToolUtils = {
	/**
	 * Writes skip approval inside `/mnt/chat` (the chat's own scratch tree), or
	 * inside a writable folder from the merged settings (last matching folder wins).
	 */
	requiresApproval: ({
		path,
		context,
	}: {
		path: string;
		context: zAgentContext;
	}): boolean => {
		const normalized = normalizeAbsolutePath(path);
		if (
			normalized &&
			PathUtils.fromMount({ path: normalized })?.mount === "chat"
		)
			return false;

		const { folders } = SettingsUtils.of(context.user, context.chat?.project);
		return !folders.findLast((folder) => contains(folder.path, path))
			?.whitelist;
	},
} as const;
