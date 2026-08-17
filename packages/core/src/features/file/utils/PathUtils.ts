import { z } from "zod";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";

export type PathLike =
	| { path?: string[] | null; uri?: string | null }
	| string[]
	| string;
export const PathLike = z.custom<PathLike>();

const MOUNT = "/mnt";
const WEB = "web:";

/**
 * The three trees the mount is made of. Each holds directories named by the id
 * of what they came from, so a path says what it is and where it came from:
 * `/mnt/uploads/<uploadId>`, `/mnt/skills/<uploadId>`, `/mnt/chat/<chatId>`.
 *
 * Only `chat` is writable. An upload or a skill is the same file for every chat
 * that points at it, so a chat that wants to change one copies it across first.
 */
export const FileMounts = ["uploads", "skills", "chat"] as const;
export type FileMount = (typeof FileMounts)[number];

export const HOSTNAME_REGEX = /^https?:\/\/?(?:www\.)?([^/]+)/i;

export const PathUtils = {
	mount: MOUNT,
	mounts: FileMounts,

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
		uri = uri.replace(new RegExp(`^${CommonUtils.escapeRegex(WEB)}`), "");
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
				path = path.replace(`^${CommonUtils.escapeRegex(mount)}`, () => {
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
	 * Parse a path on the mount into the tree it belongs to, the id of the
	 * upload, skill or chat it came from, and the path within that.
	 *
	 * `path` is the whole path below the mount, which is what everything that
	 * only has to place a file addresses it by; `mount` and `id` are for the
	 * things that care which tree it landed in.
	 */
	fromMount: ({
		path,
		root = MOUNT,
	}: {
		path: string[] | string;
		root?: string;
	}) => {
		if (typeof path !== "string") path = path.join("/");

		if (!path.startsWith(root)) return null;

		path = path.replace(new RegExp(`^${CommonUtils.escapeRegex(root)}`), "");

		const parts = path.split(/[\\/]/).filter(Boolean);

		const found = FileMounts.find((name) => name === parts[0]);

		return {
			path: parts,
			mount: found,
			id: found ? parts[1] : undefined,
			rest: found ? parts.slice(2) : [],
		};
	},

	/**
	 * Same as {@link fromMount}, but throws an error instead of returning null if the path is not in the mount.
	 */
	fromMountOrThrow: ({
		path,
		root = MOUNT,
	}: {
		path: string[] | string;
		root?: string;
	}) => {
		const result = PathUtils.fromMount({ path, root });
		if (!result) throw new Error(`Path ${path} is not in mount ${root}`);

		return result;
	},

	/**
	 * Stringify a path on the mount.
	 *
	 * Given a tree and an id, `path` is read as being within them; given
	 * neither, it is read as the whole path below the mount.
	 */
	toMount: ({
		path = [],
		mount,
		id,
		root = MOUNT,
	}: {
		path?: string[] | string;
		mount?: FileMount;
		id?: string | null;
		root?: string;
	}) => {
		if (typeof path === "string") path = path.split(/[\\/]/);

		if (root.endsWith("/")) root = root.slice(0, -1);

		return `${root}/${[mount, id, ...path].filter(Boolean).join("/")}`;
	},

	/**
	 * Convert any {@link PathLike} to a mount path.
	 */
	asMount: (from: PathLike, root = MOUNT): string | undefined => {
		if (typeof from === "string") from = { uri: from };

		if (root.endsWith("/")) root = root.slice(0, -1);

		if (Array.isArray(from)) from = { path: from };
		return from.path
			? `${root}/${from.path.join("/")}`
			: (from.uri ?? undefined);
	},

	/**
	 * Convert any {@link PathLike} to a plain path below the mount.
	 */
	asPath: (from: PathLike, root = MOUNT): string[] | undefined => {
		if (typeof from === "string") from = { uri: from };
		if (Array.isArray(from)) from = { path: from };

		from.uri = from.uri?.replace(
			new RegExp(`^${CommonUtils.escapeRegex(root)}`),
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
