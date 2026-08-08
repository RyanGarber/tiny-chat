import { createId } from "@paralleldrive/cuid2";
import type { zChat } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type { FileNode } from "@tiny-chat/core/src/features/file/types/file.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { ByteString, FileContent, FsStat, IFileSystem } from "just-bash";
import { type File, Prisma } from "../../../../generated/prisma/client.ts";
import { UploadUtils } from "../../upload/utils/UploadUtils.ts";

/**
 * Virtual filesystem for skills, uploads, repos, and chat files.
 * Used by file tools and the virtual Bash environment.
 */
export class FilesystemService implements IFileSystem {
	readonly user: zUser;
	readonly chat: zChat | null;
	readonly uploads: string[];
	readonly mount: string;

	protected nodes: FileNode[] = [];

	constructor(
		user: zUser,
		chat: zChat | undefined | null,
		uploads: string[],
		mount: string = PathUtils.mount,
	) {
		this.user = user;
		this.chat = chat ?? null;
		this.uploads = uploads;
		this.mount = mount;
	}

	clone(mount?: string): FilesystemService {
		const clone = new FilesystemService(
			this.user,
			this.chat,
			[...this.uploads],
			mount ?? this.mount,
		);
		clone.nodes = structuredClone(this.nodes);
		clone.setMounts();
		return clone;
	}

	async fetch(): Promise<void> {
		this.nodes.splice(0, this.nodes.length);

		const rows = await globalThis.prisma.$queryRaw<
			{
				chat_file_id: string | null;
				chat_file_path: string[] | null;
				chat_file_lines: bigint | null;
				chat_file_created_at: Date | null;
				upload_file_id: string | null;
				upload_file_path: string[] | null;
				upload_file_lines: bigint | null;
				upload_file_created_at: Date | null;
				upload_id: string | null;
				upload_name: string | null;
			}[]
		>`
    WITH
      chat_files AS (
        SELECT
          f.id,
          f.path,
          f."uploadId",
          f."createdAt",
          COALESCE(
            array_length(
              string_to_array(try_decode_utf8(f.data), E'\n'),
              1
            ),
            0
          ) AS lines,
          u.name AS upload_name
        FROM file f
        LEFT JOIN upload u ON u.id = f."uploadId"
          WHERE f."chatId" = ${this.chat?.id ?? null}
          AND ${this.chat?.id !== undefined ? Prisma.sql`f."chatId" IS NOT NULL` : Prisma.sql`FALSE`}
      ),
      upload_files AS (
        SELECT
          f.id,
          f.path,
          f."uploadId",
          f."createdAt",
          COALESCE(
            array_length(
              string_to_array(try_decode_utf8(f.data), E'\n'),
              1
            ),
            0
          ) AS lines,
          u.name AS upload_name
        FROM file f
        LEFT JOIN upload u ON u.id = f."uploadId"
          WHERE f."chatId" IS NULL
          AND (
            ${this.uploads.length > 0 ? Prisma.sql`f."uploadId" = ANY(${this.uploads}::text[])` : Prisma.sql`FALSE`}
          )
      )
    SELECT
      cf.id            AS chat_file_id,
      cf.path          AS chat_file_path,
      cf.lines         AS chat_file_lines,
      cf."createdAt"   AS chat_file_created_at,
      uf.id            AS upload_file_id,
      uf.path          AS upload_file_path,
      uf.lines         AS upload_file_lines,
      uf."createdAt"   AS upload_file_created_at,
      COALESCE(cf."uploadId", uf."uploadId") AS upload_id,
      COALESCE(cf.upload_name, uf.upload_name) AS upload_name
    FROM chat_files cf
    FULL OUTER JOIN upload_files uf
      ON cf."uploadId" = uf."uploadId"
     AND cf.path = uf.path
  `;

		this.nodes.push({
			uri: "",
			path: [],
			isDirectory: true,
			chatFile: null,
			uploadFile: null,
			uploadId: null,
			uploadName: null,
			createdAt: new Date(0),
		});

		for (const row of rows) {
			this.nodes.push({
				uri: "",
				path: [
					...(row.upload_id ? [row.upload_id] : []),
					...(row.chat_file_path ?? row.upload_file_path ?? []),
				],
				isDirectory: false,
				chatFile: row.chat_file_id
					? {
							id: row.chat_file_id,
							lines: Number(row.chat_file_lines ?? 0),
						}
					: null,
				uploadFile: row.upload_file_id
					? {
							id: row.upload_file_id,
							lines: Number(row.upload_file_lines ?? 0),
						}
					: null,
				uploadId: row.upload_id,
				uploadName: row.upload_name,
				createdAt:
					row.chat_file_created_at ?? row.upload_file_created_at ?? new Date(0),
			});
		}

		this.setMounts();
	}

	setMounts() {
		for (const node of this.nodes) {
			node.uri = PathUtils.toMount({
				uploadId: node.uploadId,
				path: node.path,
				mount: this.mount,
			});
		}
	}

	/** Whether `path` exists as a known leaf, and/or has deeper known paths beneath it. */
	locate(path: string[]) {
		const exact = this.nodes.find((f) => PathUtils.equals(f.path, path));
		const hasDeeper = this.nodes.some((other) =>
			PathUtils.contains({ descendent: other.path, parent: path }),
		);
		return { exact, hasDeeper };
	}

	async getFile(path: string, options?: { original?: boolean }): Promise<File> {
		console.log(`getFile(${path})`);

		const uri = PathUtils.fromMount({ path, mount: this.mount });
		if (!uri) throw new Error("ENOENT: invalid path");

		const { exact } = this.locate(uri.path);
		if (!exact || exact.isDirectory)
			throw new Error(`ENOENT: no such file or directory: ${path}`);

		const file = await globalThis.prisma.file.findUnique({
			where: {
				id:
					exact.chatFile && !options?.original
						? exact.chatFile.id
						: exact.uploadFile?.id,
			},
		});
		if (!file) throw new Error(`ENOENT: no such file or directory: ${path}`);
		console.log(file);
		return file;
	}

	async readFile(
		path: string,
		options?:
			| { encoding?: BufferEncoding | null; original?: boolean }
			| BufferEncoding,
	): Promise<string> {
		console.log(`readFile(${path})`);
		const encoding = typeof options === "string" ? options : options?.encoding;
		const result = fromBuffer(
			await this.readFileBuffer(path, omit(options, "encoding")),
			encoding,
		);
		console.log(result);
		return result;
	}

	async readFileBytes(
		path: string,
		options?: { original?: boolean },
	): Promise<ByteString> {
		console.log(`readFileBytes(${path})`);
		const result = fromBuffer(
			await this.readFileBuffer(path, options),
			"binary",
		) as unknown as ByteString;
		console.log(result);
		return result;
	}

	async readFileBuffer(
		path: string,
		options?: { original?: boolean },
	): Promise<Uint8Array> {
		console.log(`readFileBuffer(${path})`);
		const file = await this.getFile(path, options);
		const result = file.data;
		console.log(result);
		return result;
	}

	async writeFile(
		path: string,
		content: FileContent,
		options?: { encoding?: BufferEncoding } | BufferEncoding,
	) {
		console.log(`writeFile(${path})`);

		const uri = PathUtils.fromMount({ path, mount: this.mount });
		if (!uri) throw new Error("ENOENT: invalid path");

		if (!this.chat) {
			throw new Error(`EACCES: permission denied, writeFile '${path}'`);
		}

		const encoding = typeof options === "string" ? options : options?.encoding;
		const data = toBuffer(content, encoding);

		const { exact } = this.locate(uri.path);
		const id = exact?.chatFile?.id ?? createId();

		console.log(
			"INSERTED:",
			await globalThis.prisma.file.upsert({
				where: {
					id,
				},
				create: {
					id,
					user: { connect: { id: this.user.id } },
					chat: { connect: { id: this.chat.id } },
					...(uri.uploadId
						? { upload: { connect: { id: uri.uploadId } } }
						: {}),
					path: uri.uploadId ? uri.uploadPath : uri.path,
					data: Buffer.from(data),
					mime: await FileTypeUtils.getMime({
						data,
						path: uri.path,
						fallback: "text/plain",
					}),
				},
				update: {
					path: uri.uploadId ? uri.uploadPath : uri.path,
					data: Buffer.from(data),
					mime: await FileTypeUtils.getMime({
						data,
						path: uri.path,
						fallback: "text/plain",
					}),
					createdAt: new Date(),
				},
			}),
		);

		await this.fetch();
	}

	async appendFile(
		path: string,
		content: FileContent,
		options?: { encoding?: BufferEncoding } | BufferEncoding,
	) {
		console.log(`appendFile(${path})`);

		const uri = PathUtils.fromMount({ path, mount: this.mount });
		if (!uri) throw new Error("ENOENT: invalid path");

		if (!this.chat) {
			throw new Error(`EACCES: permission denied, appendFile '${path}'`);
		}

		const encoding = typeof options === "string" ? options : options?.encoding;
		const data = toBuffer(content, encoding);

		let source: File | null;
		try {
			source = await this.getFile(path);
		} catch {
			source = null;
		}

		const { exact } = this.locate(uri.path);
		const id = exact?.chatFile?.id ?? createId();
		const appendedData = Buffer.concat([source?.data ?? Buffer.alloc(0), data]);

		await globalThis.prisma.file.upsert({
			where: {
				id,
			},
			create: {
				id,
				user: { connect: { id: this.user.id } },
				chat: { connect: { id: this.chat.id } },
				...(uri.uploadId ? { upload: { connect: { id: uri.uploadId } } } : {}),
				path: uri.uploadId ? uri.uploadPath : uri.path,
				data: appendedData,
				mime: await FileTypeUtils.getMime({
					data: appendedData,
					path: uri.path,
					fallback: "text/plain",
				}),
			},
			update: {
				path: uri.uploadId ? uri.uploadPath : uri.path,
				data: appendedData,
				mime: await FileTypeUtils.getMime({
					data: appendedData,
					path: uri.path,
					fallback: "text/plain",
				}),
				createdAt: new Date(),
			},
		});

		await this.fetch();
	}

	async exists(path: string): Promise<boolean> {
		console.log(`exists(${path})`);

		const uri = PathUtils.fromMount({ path, mount: this.mount });
		if (!uri) return false;

		const { exact, hasDeeper } = this.locate(uri.path);
		const result = !!exact || hasDeeper;

		return Promise.resolve(result);
	}

	async stat(path: string): Promise<FsStat> {
		console.log(`stat(${path})`);

		const uri = PathUtils.fromMount({ path, mount: this.mount });
		if (!uri) throw new Error("ENOENT: invalid path");

		const { exact, hasDeeper } = this.locate(uri.path);

		// A path is a file if it exists at all (and isn't the synthetic root); it's a
		// directory if other, deeper paths exist within it (or it's flagged as one).
		if (exact && !exact.isDirectory) {
			const file = await this.getFile(path);
			return {
				isFile: true,
				isDirectory: false,
				isSymbolicLink: false,
				mode: 0o755,
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
				mode: 0o755,
				size: 0,
				mtime: mtime[0] ?? new Date(0),
			};
		}

		throw new Error("ENOENT: no such file or directory");
	}

	async lstat(path: string): Promise<FsStat> {
		console.log(`lstat(${path})`);

		return await this.stat(path);
	}

	async mkdir(
		_path: string,
		_options?: { recursive?: boolean },
	): Promise<void> {
		console.log(`mkdir(${_path})`);
		return Promise.resolve();
	}

	async readdir(path: string): Promise<string[]> {
		console.log(`readdir(${path})`);
		const entries = await this.readdirWithFileTypes(path);

		return entries.map((e) => e.name);
	}

	async readdirWithFileTypes(path: string) {
		console.log(`readdirWithFileTypes(${path})`);

		const uri = PathUtils.fromMount({ path, mount: this.mount });
		if (!uri) throw new Error("ENOENT: invalid path");

		const basePath = uri.path;

		// Collect the immediate child name of every known path nested under `basePath`,
		// tracking the most recent mtime seen among its descendants.
		const names = new Map<string, Date>();
		for (const f of this.nodes) {
			if (!PathUtils.contains({ descendent: f.path, parent: basePath }))
				continue;
			const name = f.path[basePath.length];
			const mtime = names.get(name);
			if (!mtime || f.createdAt > mtime) names.set(name, f.createdAt);
		}

		const result = [...names]
			.filter(([name]) =>
				UploadUtils.shouldIncludeFile({ path: [...basePath, name] }),
			)
			.map(([name, mtime]) => {
				const childPath = [...basePath, name];
				const childUri = PathUtils.toMount({
					path: childPath,
					mount: this.mount,
				});
				const isDirectory = this.nodes.some((f) =>
					PathUtils.contains({ descendent: f.path, parent: childPath }),
				);
				return {
					name,
					path: childPath,
					isFile: !isDirectory,
					isDirectory,
					isSymbolicLink: false,
					mtime,
					uri: childUri,
				};
			});

		return Promise.resolve(result);
	}

	async rm(
		path: string,
		options?: { recursive?: boolean; force?: boolean },
	): Promise<void> {
		console.log(`rm(${path})`);

		const uri = PathUtils.fromMount({ path, mount: this.mount });
		if (!uri) {
			if (options?.force) return;
			throw new Error("ENOENT: invalid path");
		}

		const { exact, hasDeeper } = this.locate(uri.path);

		if (!exact && !hasDeeper) {
			if (options?.force) return;
			throw new Error(`ENOENT: no such file or directory: ${path}`);
		}

		if (!this.chat) {
			throw new Error(`EACCES: permission denied, unlink '${path}'`);
		}

		// A direct file target is always subject to the chat-ownership check: files copied
		// from (read-only) uploads shadow the original but can't delete it out from under it.
		if (exact && !exact.isDirectory) {
			if (!exact.chatFile) {
				throw new Error(`EACCES: permission denied, unlink '${path}'`);
			}
			await globalThis.prisma.file.deleteMany({
				where: {
					id: exact.chatFile.id,
				},
			});
			return;
		}

		if (!options?.recursive) {
			throw new Error(`EISDIR: illegal operation on a directory, rm '${path}'`);
		}

		// Recursively remove only the chat-owned files under this path; any (read-only)
		// original upload files nested within are silently left in place.
		const targets = this.nodes.filter(
			(f) =>
				!f.isDirectory &&
				PathUtils.contains({ descendent: f.path, parent: uri.path }) &&
				f.chatFile,
		);

		if (targets.length) {
			await globalThis.prisma.file.deleteMany({
				where: {
					id: {
						in: targets
							.map((t) => t.chatFile?.id)
							.filter((id) => id !== undefined),
					},
				},
			});
		}

		await this.fetch();
	}

	async cp(
		src: string,
		dest: string,
		options?: { recursive?: boolean },
	): Promise<void> {
		console.log(`cp(${src}, ${dest})`);

		const srcUri = PathUtils.fromMount({ path: src, mount: this.mount });
		if (!srcUri) throw new Error("ENOENT: invalid path");

		const { exact, hasDeeper } = this.locate(srcUri.path);

		if (exact && !exact.isDirectory) {
			const srcFile = await this.getFile(src);
			await this.writeFile(dest, srcFile.data);
			return;
		}

		if (!hasDeeper)
			throw new Error(`ENOENT: no such file or directory: ${src}`);
		if (!options?.recursive) {
			throw new Error(`EISDIR: illegal operation on a directory, cp '${src}'`);
		}

		const destUri = PathUtils.fromMount({ path: dest, mount: this.mount });
		if (!destUri) throw new Error("ENOENT: invalid path");

		const files = this.nodes.filter(
			(file) =>
				!file.isDirectory &&
				PathUtils.contains({ descendent: file.path, parent: srcUri.path }),
		);

		for (const file of files) {
			const relative = file.path.slice(srcUri.path.length);
			const childSrc = PathUtils.toMount({
				path: file.path,
				mount: this.mount,
			});
			const childDest = PathUtils.toMount({
				path: [...destUri.path, ...relative],
				mount: this.mount,
			});
			const srcFile = await this.getFile(childSrc);
			await this.writeFile(childDest, srcFile.data);
		}

		await this.fetch();
	}

	async mv(src: string, dest: string): Promise<void> {
		console.log(`mv(${src}, ${dest})`);

		await this.cp(src, dest, { recursive: true });
		await this.rm(src, { recursive: true });

		await this.fetch();
	}

	async symlink(_target: string, _linkPath: string): Promise<void> {
		console.log(`symlink(${_target}, ${_linkPath})`);
		return Promise.reject(new Error("ENOENT: operation not supported"));
	}

	async link(_target: string, _linkPath: string): Promise<void> {
		console.log(`link(${_target}, ${_linkPath})`);
		return Promise.reject(new Error("ENOENT: operation not supported"));
	}

	async readlink(path: string): Promise<string> {
		console.log(`readlink(${path})`);
		return Promise.resolve(path);
	}

	async realpath(path: string): Promise<string> {
		console.log(`realpath(${path})`);
		return Promise.resolve(path);
	}

	async chmod(_path: string, _mode: number): Promise<void> {
		console.log(`chmod(${_path}, ${_mode})`);
		return Promise.resolve();
	}

	async utimes(_path: string, _atime: Date, _mtime: Date): Promise<void> {
		console.log(`utimes(${_path})`);
		return Promise.resolve();
	}

	getAllPaths(): string[] {
		console.log("getAllPaths()");

		return this.nodes
			.filter((file) => file.path.length > 0)
			.map((file) => PathUtils.toMount(file));
	}

	getAllNodes() {
		return this.nodes;
	}

	resolvePath(base: string, path: string): string {
		console.log(`resolvePath(${base}, ${path})`);

		// hardcoded `/mnt/chat` prefix replaced 7/18/26
		const prefix = this.mount.replace(/\/$/, "");
		base = base.replace(prefix, "");

		if (path.startsWith("/")) {
			const result = `${prefix}${normalizePath(path)}`;
			console.log(result);
			return result;
		}

		return `${prefix}${normalizePath(`${base}/${path}`)}`;
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

function omit<
	T extends Record<string, unknown> | string | undefined,
	K extends T extends Record<string, unknown> ? keyof T : never,
>(options: T, ...keys: K[]): Pick<T, Exclude<keyof T, K>> {
	if (typeof options !== "object") {
		return options;
	}
	const result = { ...options };
	for (const key of keys) {
		delete result[key];
	}
	return result;
}
