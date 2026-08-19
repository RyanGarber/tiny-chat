import { createId } from "@paralleldrive/cuid2";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type {
	FileNode,
	FilesystemSpec,
} from "@tiny-chat/core/src/features/file/types/file.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import {
	type FileMount,
	PathUtils,
} from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { ByteString, FileContent, FsStat, IFileSystem } from "just-bash";
import { type File, Prisma } from "../../../../generated/prisma/client.ts";

/**
 * The virtual filesystem behind the file tools and the virtual Bash
 * environment, laid out as three trees below one root:
 *
 *   /mnt/uploads/<uploadId>   what the user uploaded or cloned — read only
 *   /mnt/skills/<uploadId>    the skills the message is configured with — read only
 *   /mnt/chat/<chatId>        what the model wrote in this chat — the only writable tree
 *
 * A file exists at exactly one path. Uploads and skills are the same bytes for
 * every chat that points at them, so nothing may write over them; a chat that
 * wants to change one copies it into its own tree first.
 *
 * Everything here is built from a list of upload and skill ids, which come out
 * of messages (see `AgentUtils.getMounts`). A chat id only adds the writable
 * tree, and is optional: a message still being typed has no chat and still has
 * a filesystem, which is how an attachment can be read before it is sent.
 */
export interface FilesystemOptions extends FilesystemSpec {
	user: zUser;
	/** Where the root sits, for when this is mounted inside another filesystem. */
	root?: string;
}

interface FileRow {
	id: string;
	mount: FileMount;
	owner_id: string;
	name: string | null;
	path: string[];
	lines: bigint | null;
	created_at: Date;
}

export class FilesystemService implements IFileSystem {
	readonly user: zUser;
	readonly chat: string | null;
	readonly uploads: string[];
	readonly skills: string[];
	readonly root: string;

	protected nodes: FileNode[] = [];

	constructor({ user, chat, uploads, skills, root }: FilesystemOptions) {
		this.user = user;
		this.chat = chat ?? null;
		this.uploads = uploads ?? [];
		this.skills = skills ?? [];
		this.root = root ?? PathUtils.mount;
	}

	clone(root?: string): FilesystemService {
		const clone = new FilesystemService({
			user: this.user,
			chat: this.chat,
			uploads: [...this.uploads],
			skills: [...this.skills],
			root: root ?? this.root,
		});
		clone.nodes = structuredClone(this.nodes);
		clone.setRoot();
		return clone;
	}

	async fetch(): Promise<void> {
		// An id reaches here straight out of message text, so ownership is what
		// keeps a guessed one from mounting someone else's upload.
		const rows = await globalThis.prisma.$queryRaw<FileRow[]>`
    SELECT
      f.id,
      CASE
        WHEN f."chatId" IS NOT NULL THEN 'chat'
        WHEN u.type = 'SKILL' THEN 'skills'
        ELSE 'uploads'
      END                                   AS mount,
      COALESCE(f."chatId", f."uploadId")    AS owner_id,
      u.name                                AS name,
      f.path                                AS path,
      COALESCE(
        array_length(string_to_array(try_decode_utf8(f.data), E'\n'), 1),
        0
      )                                     AS lines,
      f."createdAt"                         AS created_at
    FROM file f
    LEFT JOIN upload u ON u.id = f."uploadId"
    WHERE f."userId" = ${this.user.id}
      AND (
        ${
					this.chat
						? // A chat file belongs to no upload: nothing shadows anything on
							// this mount, so a row claiming both is pre-migration leftover
							// rather than a file at this path.
							Prisma.sql`(f."chatId" = ${this.chat} AND f."uploadId" IS NULL)`
						: Prisma.sql`FALSE`
				}
        OR ${
					this.uploads.length || this.skills.length
						? Prisma.sql`(
              f."chatId" IS NULL
              AND f."uploadId" = ANY(${[...this.uploads, ...this.skills]}::text[])
            )`
						: Prisma.sql`FALSE`
				}
      )
  `;

		this.nodes = [
			...this.getRoots(),
			...rows.map(
				(row): FileNode => ({
					uri: "",
					path: [row.mount, row.owner_id, ...row.path],
					mount: row.mount,
					id: row.owner_id,
					file: row.id,
					name: row.name,
					isDirectory: false,
					lines: Number(row.lines ?? 0),
					createdAt: row.created_at,
				}),
			),
		];

		this.setRoot();
	}

	/**
	 * The directories that are there whether or not anything is in them: the
	 * root, the three trees, and this chat's own directory — which has to exist
	 * before anything can be written into it.
	 */
	protected getRoots(): FileNode[] {
		const directory = (path: string[]): FileNode => ({
			uri: "",
			path,
			mount: (PathUtils.mounts.find((mount) => mount === path[0]) ??
				null) as FileMount | null,
			id: path[1] ?? null,
			file: null,
			name: null,
			isDirectory: true,
			lines: 0,
			createdAt: new Date(0),
		});

		return [
			directory([]),
			...PathUtils.mounts.map((mount) => directory([mount])),
			...(this.chat ? [directory(["chat", this.chat])] : []),
		];
	}

	setRoot() {
		for (const node of this.nodes) {
			node.uri = PathUtils.toMount({ path: node.path, root: this.root });
		}
	}

	/** Parse `path`, or fail the way the caller's operation should fail. */
	protected parse(path: string) {
		const uri = PathUtils.fromMount({ path, root: this.root });
		if (!uri) throw new Error(`ENOENT: no such file or directory: ${path}`);
		return uri;
	}

	/**
	 * Where a path may be written, which is this chat's own tree and nowhere
	 * else. Uploads and skills are shared, so the error says to copy rather than
	 * leaving the model to guess why its write bounced.
	 */
	protected checkWritable(path: string, operation: string) {
		const uri = this.parse(path);

		if (!this.chat) {
			throw new Error(
				`EROFS: read-only file system, ${operation} '${path}' — this message is not in a chat yet`,
			);
		}

		if (uri.mount !== "chat" || uri.id !== this.chat) {
			throw new Error(
				`EROFS: read-only file system, ${operation} '${path}' — only ${PathUtils.toMount({ mount: "chat", id: this.chat, root: this.root })} is writable, so copy the file there first`,
			);
		}

		if (!uri.rest.length) {
			throw new Error(
				`EISDIR: illegal operation on a directory, ${operation} '${path}'`,
			);
		}

		return uri;
	}

	/** Whether `path` exists as a known leaf, and/or has deeper known paths beneath it. */
	locate(path: string[]) {
		const exact = this.nodes.find((f) => PathUtils.equals(f.path, path));
		const hasDeeper = this.nodes.some((other) =>
			PathUtils.contains({ descendent: other.path, parent: path }),
		);
		return { exact, hasDeeper };
	}

	async getFile(path: string): Promise<File> {
		const { path: parts } = this.parse(path);

		const { exact } = this.locate(parts);
		if (!exact?.file || exact.isDirectory)
			throw new Error(`ENOENT: no such file or directory: ${path}`);

		const file = await globalThis.prisma.file.findUnique({
			where: { id: exact.file },
		});
		if (!file) throw new Error(`ENOENT: no such file or directory: ${path}`);
		return file;
	}

	async readFile(
		path: string,
		options?: { encoding?: BufferEncoding | null } | BufferEncoding,
	): Promise<string> {
		const encoding = typeof options === "string" ? options : options?.encoding;
		return fromBuffer(await this.readFileBuffer(path), encoding);
	}

	async readFileBytes(path: string): Promise<ByteString> {
		return fromBuffer(
			await this.readFileBuffer(path),
			"binary",
		) as unknown as ByteString;
	}

	async readFileBuffer(path: string): Promise<Uint8Array> {
		return (await this.getFile(path)).data;
	}

	async writeFile(
		path: string,
		content: FileContent,
		options?: { encoding?: BufferEncoding } | BufferEncoding,
	) {
		const uri = this.checkWritable(path, "writeFile");

		const encoding = typeof options === "string" ? options : options?.encoding;
		const data = toBuffer(content, encoding);

		await this.save({ path: uri.rest, data });
		await this.fetch();
	}

	async appendFile(
		path: string,
		content: FileContent,
		options?: { encoding?: BufferEncoding } | BufferEncoding,
	) {
		const uri = this.checkWritable(path, "appendFile");

		const encoding = typeof options === "string" ? options : options?.encoding;
		const data = toBuffer(content, encoding);

		let existing: File | null;
		try {
			existing = await this.getFile(path);
		} catch {
			existing = null;
		}

		await this.save({
			path: uri.rest,
			data: Buffer.concat([existing?.data ?? Buffer.alloc(0), data]),
		});
		await this.fetch();
	}

	/**
	 * Write `data` to `path` within this chat's tree, replacing whatever was
	 * there. Does not refetch, so a caller writing more than one file pays for
	 * one refresh rather than one per file.
	 */
	protected async save({ path, data }: { path: string[]; data: Uint8Array }) {
		if (!this.chat) throw new Error("EROFS: read-only file system");

		const { exact } = this.locate(["chat", this.chat, ...path]);
		const id = exact?.file ?? createId();

		const file = {
			path,
			data: Buffer.from(data),
			mime: await FileTypeUtils.getMime({
				data,
				path,
				fallback: "text/plain",
			}),
		};

		await globalThis.prisma.file.upsert({
			where: { id },
			create: {
				id,
				user: { connect: { id: this.user.id } },
				chat: { connect: { id: this.chat } },
				...file,
			},
			update: { ...file, createdAt: new Date() },
		});
	}

	async exists(path: string): Promise<boolean> {
		const uri = PathUtils.fromMount({ path, root: this.root });
		if (!uri) return false;

		const { exact, hasDeeper } = this.locate(uri.path);
		return !!exact || hasDeeper;
	}

	async stat(path: string): Promise<FsStat> {
		const uri = this.parse(path);

		const { exact, hasDeeper } = this.locate(uri.path);

		// A path is a directory if other, deeper paths exist within it, or if it
		// is one of the ones that is always there; anything else that is known at
		// all is a file.
		if (exact && !exact.isDirectory) {
			const file = await this.getFile(path);
			return {
				isFile: true,
				isDirectory: false,
				isSymbolicLink: false,
				mode: this.isWritable(uri) ? 0o755 : 0o555,
				size: file.data.byteLength,
				mtime: file.createdAt,
			};
		}

		if (hasDeeper || exact?.isDirectory) {
			const mtime = this.nodes
				.filter((f) =>
					PathUtils.contains({ descendent: f.path, parent: uri.path }),
				)
				.map((f) => f.createdAt);
			mtime.sort((a, b) => b.getTime() - a.getTime());
			return {
				isFile: false,
				isDirectory: true,
				isSymbolicLink: false,
				mode: this.isWritable(uri) ? 0o755 : 0o555,
				size: 0,
				mtime: mtime[0] ?? new Date(0),
			};
		}

		throw new Error(`ENOENT: no such file or directory: ${path}`);
	}

	protected isWritable(uri: { mount?: FileMount; id?: string }) {
		return !!this.chat && uri.mount === "chat" && uri.id === this.chat;
	}

	async lstat(path: string): Promise<FsStat> {
		return await this.stat(path);
	}

	/**
	 * Directories are implied by the paths of the files in them, so there is
	 * nothing to create — but a write into a directory that does not exist yet
	 * has to be allowed to say so.
	 */
	async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
		const uri = PathUtils.fromMount({ path, root: this.root });
		if (uri) {
			const { exact, hasDeeper } = this.locate(uri.path);
			if (exact?.isDirectory || hasDeeper) return;
		}
		this.checkWritable(path, "mkdir");
	}

	async readdir(path: string): Promise<string[]> {
		const entries = await this.readdirWithFileTypes(path);
		return entries.map((e) => e.name);
	}

	async readdirWithFileTypes(path: string) {
		const uri = this.parse(path);

		const { exact, hasDeeper } = this.locate(uri.path);
		if (!hasDeeper && !exact?.isDirectory) {
			throw new Error(`ENOENT: no such file or directory: ${path}`);
		}

		// Collect the immediate child name of every known path nested under the
		// directory, tracking the most recent mtime seen among its descendants.
		const names = new Map<string, Date>();
		for (const f of this.nodes) {
			if (!PathUtils.contains({ descendent: f.path, parent: uri.path }))
				continue;
			const name = f.path[uri.path.length];
			const mtime = names.get(name);
			if (!mtime || f.createdAt > mtime) names.set(name, f.createdAt);
		}

		return [...names].map(([name, mtime]) => {
			const childPath = [...uri.path, name];
			const isDirectory = this.nodes.some(
				(f) =>
					PathUtils.contains({ descendent: f.path, parent: childPath }) ||
					(f.isDirectory && PathUtils.equals(f.path, childPath)),
			);
			return {
				name,
				// An upload or skill directory is named by its id, which says
				// nothing about what is in it, so what it is called comes along.
				// Only at that level: above it the segment is the tree's own
				// name, and below it the file's.
				label:
					(childPath.length === 2 &&
						this.nodes.find(
							(f) =>
								f.name &&
								PathUtils.contains({
									descendent: f.path,
									parent: childPath,
								}),
						)?.name) ||
					null,
				path: childPath,
				isFile: !isDirectory,
				isDirectory,
				isSymbolicLink: false,
				mtime,
				uri: PathUtils.toMount({ path: childPath, root: this.root }),
			};
		});
	}

	async rm(
		path: string,
		options?: { recursive?: boolean; force?: boolean },
	): Promise<void> {
		const uri = PathUtils.fromMount({ path, root: this.root });
		if (!uri) {
			if (options?.force) return;
			throw new Error(`ENOENT: no such file or directory: ${path}`);
		}

		const { exact, hasDeeper } = this.locate(uri.path);

		if ((!exact || exact.isDirectory) && !hasDeeper) {
			if (options?.force) return;
			throw new Error(`ENOENT: no such file or directory: ${path}`);
		}

		this.checkWritable(path, "unlink");

		if (exact?.file && !exact.isDirectory) {
			await globalThis.prisma.file.delete({ where: { id: exact.file } });
			await this.fetch();
			return;
		}

		if (!options?.recursive) {
			throw new Error(`EISDIR: illegal operation on a directory, rm '${path}'`);
		}

		const targets = this.nodes.filter(
			(f) =>
				!f.isDirectory &&
				PathUtils.contains({ descendent: f.path, parent: uri.path }),
		);

		await globalThis.prisma.file.deleteMany({
			where: {
				id: { in: targets.flatMap((t) => (t.file ? [t.file] : [])) },
			},
		});

		await this.fetch();
	}

	async cp(
		src: string,
		dest: string,
		options?: { recursive?: boolean },
	): Promise<void> {
		const srcUri = this.parse(src);
		const destUri = this.checkWritable(dest, "cp");

		const { exact, hasDeeper } = this.locate(srcUri.path);

		if (exact && !exact.isDirectory) {
			const file = await this.getFile(src);
			await this.save({ path: destUri.rest, data: file.data });
			await this.fetch();
			return;
		}

		if (!hasDeeper)
			throw new Error(`ENOENT: no such file or directory: ${src}`);
		if (!options?.recursive) {
			throw new Error(`EISDIR: illegal operation on a directory, cp '${src}'`);
		}

		const files = this.nodes.filter(
			(file) =>
				!file.isDirectory &&
				PathUtils.contains({ descendent: file.path, parent: srcUri.path }),
		);

		for (const file of files) {
			const relative = file.path.slice(srcUri.path.length);
			const source = await this.getFile(file.uri);
			await this.save({
				path: [...destUri.rest, ...relative],
				data: source.data,
			});
		}

		await this.fetch();
	}

	async mv(src: string, dest: string): Promise<void> {
		await this.cp(src, dest, { recursive: true });
		await this.rm(src, { recursive: true });
	}

	async symlink(_target: string, _linkPath: string): Promise<void> {
		return Promise.reject(new Error("ENOSYS: operation not supported"));
	}

	async link(_target: string, _linkPath: string): Promise<void> {
		return Promise.reject(new Error("ENOSYS: operation not supported"));
	}

	async readlink(path: string): Promise<string> {
		return Promise.resolve(path);
	}

	async realpath(path: string): Promise<string> {
		return Promise.resolve(path);
	}

	async chmod(_path: string, _mode: number): Promise<void> {
		return Promise.resolve();
	}

	async utimes(_path: string, _atime: Date, _mtime: Date): Promise<void> {
		return Promise.resolve();
	}

	getAllPaths(): string[] {
		return this.nodes
			.filter((file) => file.path.length > 0)
			.map((file) => file.uri);
	}

	getAllNodes() {
		return this.nodes;
	}

	resolvePath(base: string, path: string): string {
		const root = this.root.replace(/\/$/, "");
		base = base.startsWith(root) ? base.slice(root.length) : base;

		if (path.startsWith("/")) return `${root}${normalizePath(path)}`;

		return `${root}${normalizePath(`${base}/${path}`)}`;
	}
}

function fromBuffer(
	buffer: Uint8Array,
	encoding?: BufferEncoding | null,
): string {
	if (encoding === "base64") {
		// Use chunked String.fromCharCode to avoid RangeError on large buffers.
		// The spread operator (...buffer) creates one argument per byte and crashes
		// on buffers larger than ~100KB due to call stack limits.
		if (typeof Buffer !== "undefined") {
			return Buffer.from(buffer).toString("base64");
		}
		const chunkSize = 65536;
		let binary = "";
		for (let i = 0; i < buffer.length; i += chunkSize) {
			const chunk = buffer.subarray(i, i + chunkSize);
			binary += String.fromCharCode(...chunk);
		}
		return btoa(binary);
	}
	if (encoding === "hex") {
		return Array.from(buffer)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}
	if (encoding === "binary" || encoding === "latin1") {
		// Use Buffer if available (Node.js) - much more efficient and avoids spread operator limits
		if (typeof Buffer !== "undefined") {
			return Buffer.from(buffer).toString(encoding);
		}

		// Browser fallback - String.fromCharCode(...buffer) fails with buffers > ~100KB
		const chunkSize = 65536; // 64KB chunks
		if (buffer.length <= chunkSize) {
			return String.fromCharCode(...buffer);
		}
		let result = "";
		for (let i = 0; i < buffer.length; i += chunkSize) {
			const chunk = buffer.subarray(i, i + chunkSize);
			result += String.fromCharCode(...chunk);
		}
		return result;
	}
	// Default to UTF-8 for text content
	return new TextDecoder().decode(buffer);
}

function toBuffer(content: FileContent, encoding?: BufferEncoding): Uint8Array {
	if (content instanceof Uint8Array) {
		return content;
	}

	if (encoding === "base64") {
		return Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
	}
	if (encoding === "hex") {
		const bytes = new Uint8Array(content.length / 2);
		for (let i = 0; i < content.length; i += 2) {
			bytes[i / 2] = parseInt(content.slice(i, i + 2), 16);
		}
		return bytes;
	}
	if (encoding === "binary" || encoding === "latin1") {
		// Use chunked approach for large strings to avoid performance issues
		const chunkSize = 65536; // 64KB chunks
		if (content.length <= chunkSize) {
			return Uint8Array.from(content, (c) => c.charCodeAt(0));
		}
		const result = new Uint8Array(content.length);
		for (let i = 0; i < content.length; i++) {
			result[i] = content.charCodeAt(i);
		}
		return result;
	}
	// Default to UTF-8 for text content
	return new TextEncoder().encode(content);
}

function normalizePath(path: string): string {
	if (!path || path === "/") return "/";

	let normalized =
		path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;

	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`;
	}

	const parts = normalized.split("/").filter((p) => p && p !== ".");
	const resolved: string[] = [];

	for (const part of parts) {
		if (part === "..") {
			resolved.pop();
		} else {
			resolved.push(part);
		}
	}

	return `/${resolved.join("/")}`;
}
