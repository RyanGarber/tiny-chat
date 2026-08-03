import { z } from "zod";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";

export type PathLike =
	| { path?: string[] | null; uri?: string | null }
	| string[]
	| string;
export const PathLike = z.custom<PathLike>();

const MOUNT = "/mnt/chat";
const WEB = "web:";

export const HOSTNAME_REGEX = /^https?:\/\/?(?:www\.)?([^/]+)/i;

export const PathUtils = {
	mount: MOUNT,

	/**
	 * Get the name of a path.
	 */
	name: (source: { path: string[] | string } | string) => {
		let path = typeof source === "string" ? source : source.path;

		if (typeof path === "string") {
			const hostname = PathUtils.hostname(path);
			if (hostname) return hostname ?? path;

			path = path.split(/[\\/]+/);
		}

		path = [...path];

		if (!path.some(Boolean)) {
			return "";
		}

		return path.pop() ?? "";
	},

	hostname: (uri: string) => {
		uri = uri.replace(new RegExp(`^${CommonUtils.getRegexEscaped(WEB)}`), "");
		const hostname = HOSTNAME_REGEX.exec(uri);
		return hostname?.[1] ?? undefined;
	},

	/**
	 * Normalize a path to a standard format, optionally enforcing forward slashes as well.
	 */
	normalize: ({
		path,
		unix = false,
	}: {
		path: string[] | string;
		unix?: boolean;
	}) => {
		if (typeof path !== "string") path = path.join("/");

		let normalized = path.replace(/^\\+\?\\(?:UNC\\)?/, "");

		if (path.startsWith("web:")) {
			return path.slice(4);
		}

		if (unix) {
			normalized = normalized.replace(/\\/g, "/");
		}

		return normalized;
	},

	/**
	 * Check if two or more paths are equal.
	 */
	equals: (...paths: (string[] | string)[]) => {
		const [reference, ...rest] = paths.map((path) => {
			if (typeof path === "string") path = path.split(/[\\/]+/);
			return path.filter(Boolean);
		});

		return rest.every((path) => path.join("/") === reference.join("/"));
	},

	/**
	 * Check if a parent has a child or descendent.
	 */
	contains: ({
		parent,
		child,
		descendent,
	}: {
		parent: string[] | string;
		child?: string[] | string;
		descendent?: string[] | string;
	}) => {
		if (typeof parent === "string") parent = parent.split(/[\\/]/);
		if (typeof child === "string") child = child.split(/[\\/]/);
		if (typeof descendent === "string") descendent = descendent.split(/[\\/]/);

		if (child && !descendent) {
			if (!parent?.length) return child.length === 1;
			return (
				child.filter(Boolean).slice(0, -1).join("/") ===
				parent.filter(Boolean).join("/")
			);
		}

		if (!child && descendent) {
			if (!parent?.length) return !!descendent.length;
			if (parent === descendent) return false;
			const parentPath = `${parent.filter(Boolean).join("/")}/`;
			const descendentPath = `${descendent.filter(Boolean).join("/")}/`;
			return (
				descendentPath !== parentPath && descendentPath.startsWith(parentPath)
			);
		}

		throw new Error("Only one of child or descendent must be provided");
	},

	/**
	 * Joins two or more paths together, keeping the leftmost path's mount if it has one.
	 */
	join: ({
		paths,
		mount = MOUNT,
	}: {
		paths: (string[] | string)[];
		mount?: string;
	}) => {
		let isMount = false;

		const [reference, ...rest] = paths.map((path, i) => {
			if (typeof path === "string") {
				path = path.replace(`^${CommonUtils.getRegexEscaped(mount)}`, () => {
					if (i !== 0)
						throw new Error("Mount must be at the beginning of a join");
					isMount = true;
					return "";
				});
				path = path.split(/[\\/]+/);
			}
			return path.filter(Boolean);
		});

		return [...(isMount ? [mount] : []), ...reference, ...rest]
			.flat()
			.join("/");
	},

	/**
	 * Split a path into an array of parts.
	 */
	split: (path: { path: string } | string) => {
		if (typeof path !== "string") path = path.path;
		return path.split(/[\\/]/).filter(Boolean);
	},

	/**
	 * Parse a mount file.
	 */
	fromMount: ({
		path,
		mount = MOUNT,
	}: {
		path: string[] | string;
		mount?: string;
	}) => {
		if (typeof path !== "string") path = path.join("/");

		if (!path.startsWith(mount)) return null;

		path = path.replace(
			new RegExp(`^${CommonUtils.getRegexEscaped(mount)}`),
			"",
		);

		const parts = path.split(/[\\/]/).filter(Boolean);

		let uploadId: string | undefined;
		let uploadPath: string[] = [];

		if (parts[0]?.length === 24) {
			[uploadId, ...uploadPath] = parts;
		}

		return { path: parts, uploadId, uploadPath };
	},

	/**
	 * Same as {@link fromMount}, but throws an error instead of returning null if the path is not in the mount.
	 */
	fromMountOrThrow: ({
		path,
		mount = MOUNT,
	}: {
		path: string[] | string;
		mount?: string;
	}) => {
		const result = PathUtils.fromMount({ path, mount });
		if (!result) throw new Error(`Path ${path} is not in mount ${mount}`);

		return result;
	},

	/**
	 * Stringify a mount file.
	 */
	toMount: ({
		path = [],
		uploadId,
		mount = MOUNT,
	}: {
		path?: string[] | string;
		uploadId?: string | null;
		mount?: string;
	}) => {
		if (typeof path === "string") path = path.split(/[\\/]/);

		path = [...path];

		if (mount.endsWith("/")) mount = mount.slice(0, -1);

		if (uploadId && path[0] === uploadId) {
			path.shift();
		}

		return `${mount}/${[uploadId, ...path].filter(Boolean).join("/")}`;
	},

	/**
	 * Convert any {@link PathLike} to a mount file.
	 */
	asMount: (from: PathLike, mount = MOUNT): string | undefined => {
		if (typeof from === "string") from = { uri: from };

		if (mount.endsWith("/")) mount = mount.slice(0, -1);

		if (Array.isArray(from)) from = { path: from };
		return from.path
			? `${mount}/${from.path.join("/")}`
			: (from.uri ?? undefined);
	},

	/**
	 * Convert any {@link PathLike} to a plain path.
	 */
	asPath: (from: PathLike, mount = MOUNT): string[] | undefined => {
		if (typeof from === "string") from = { uri: from };
		if (Array.isArray(from)) from = { path: from };

		from.uri = from.uri?.replace(
			new RegExp(`^${mount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
			"",
		);

		return from.uri
			? from.uri.split(/[\\/]/).filter(Boolean)
			: (from.path ?? undefined);
	},

	asWeb: (uri: string) => {
		return `${WEB}${uri}`;
	},
} as const;
