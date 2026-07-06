import type { ByteString, FileContent, FsStat, IFileSystem } from 'just-bash';
import {
  fromChatUri,
  mimeType,
  pathEquals,
  pathStartsWith,
  toChatUri,
} from '@tiny-chat/shared/src/utils/files.ts';
import type { zToolContext } from '@tiny-chat/shared/src/types/tool.ts';
import { createId } from '@paralleldrive/cuid2';
import type { File } from '../../generated/prisma/client.ts';
import { shouldIncludeFile } from '../utils/files.ts';
import { uploadIds } from '@tiny-chat/shared/src/utils.ts';

/**
 * Lightweight (no `data`) representation of a known path, used to answer
 * exists/stat/readdir questions without loading file contents.
 */
interface CachedPath {
  path: string[];
  uploadId: string | null;
  chatId: string | null;
  createdAt: Date;
  isDirectory: boolean;
}

export class DBFS implements IFileSystem {
  private readonly context: zToolContext;
  private readonly basePath: string;
  private readonly allPaths: CachedPath[] = [];

  constructor(context: zToolContext, basePath = '/mnt/chat/') {
    this.context = context;
    this.basePath = basePath;
  }

  async init(): Promise<void> {
    this.allPaths.splice(0, this.allPaths.length);

    const uploadIdList = [
      ...new Set([
        ...uploadIds(this.context.generation.context),
        ...this.context.skills
          .map((s) => fromChatUri(s.path)?.uploadId)
          .filter((s): s is string => Boolean(s)),
      ]),
    ];

    const select = { path: true, uploadId: true, chatId: true, createdAt: true } as const;

    const [chatFiles, uploadFiles] = await Promise.all([
      globalThis.prisma.file.findMany({
        where: { userId: this.context.user.id, chatId: this.context.chat!.id },
        select,
      }),
      uploadIdList.length
        ? globalThis.prisma.file.findMany({
            where: { userId: this.context.user.id, uploadId: { in: uploadIdList } },
            select,
          })
        : Promise.resolve([]),
    ]);

    // Files attached directly to the chat shadow the (read-only) upload files they were copied from.
    const files = [
      ...chatFiles,
      ...uploadFiles.filter(
        (uf) =>
          !chatFiles.some((cf) => cf.uploadId === uf.uploadId && pathEquals(cf.path, uf.path)),
      ),
    ];

    this.allPaths.push(
      {
        path: [],
        uploadId: null,
        chatId: this.context.chat!.id,
        createdAt: new Date(0),
        isDirectory: true,
      },
      ...files.map((f) => ({
        path: f.uploadId ? [f.uploadId, ...f.path] : f.path,
        uploadId: f.uploadId,
        chatId: f.chatId,
        createdAt: f.createdAt,
        isDirectory: false,
      })),
    );
  }

  private fullPath(uri: { uploadId?: string; path: string[] }): string[] {
    return uri.uploadId ? [uri.uploadId, ...uri.path] : uri.path;
  }

  /** Whether `path` exists as a known leaf, and/or has deeper known paths beneath it. */
  private locate(path: string[]) {
    const exact = this.allPaths.find((f) => pathEquals(f.path, path));
    const hasDeeper = this.allPaths.some(
      (f) => f.path.length > path.length && pathStartsWith(f.path, path),
    );
    return { exact, hasDeeper };
  }

  private async getFile(path: string): Promise<File> {
    console.log(`getFile(${path})`);

    const uri = fromChatUri(path, this.basePath);
    if (!uri) throw new Error('ENOENT: invalid path');

    const { exact } = this.locate(this.fullPath(uri));
    if (!exact || exact.isDirectory) throw new Error(`ENOENT: no such file or directory: ${path}`);

    const file = await globalThis.prisma.file.findFirst({
      where: {
        userId: this.context.user.id,
        uploadId: exact.uploadId,
        chatId: exact.chatId,
        path: { equals: uri.path },
      },
    });
    if (!file) throw new Error(`ENOENT: no such file or directory: ${path}`);
    console.log(file);
    return file;
  }

  async readFile(
    path: string,
    options?: { encoding?: BufferEncoding | null } | BufferEncoding,
  ): Promise<string> {
    console.log(`readFile(${path})`);
    const encoding = typeof options === 'string' ? options : options?.encoding;
    const result = fromBuffer(await this.readFileBuffer(path), encoding);
    console.log(result);
    return result;
  }

  async readFileBytes(path: string): Promise<ByteString> {
    console.log(`readFileBytes(${path})`);
    const result = fromBuffer(await this.readFileBuffer(path), 'binary') as unknown as ByteString;
    console.log(result);
    return result;
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    console.log(`readFileBuffer(${path})`);
    const file = await this.getFile(path);
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

    const uri = fromChatUri(path, this.basePath);
    if (!uri) throw new Error('ENOENT: invalid path');

    const encoding = typeof options === 'string' ? options : options?.encoding;
    const data = toBuffer(content, encoding);

    const existing = await globalThis.prisma.file.findFirst({
      where: {
        userId: this.context.user.id,
        uploadId: uri.uploadId ?? null,
        chatId: this.context.chat!.id,
        path: { equals: uri.path ?? [] },
      },
    });

    const newId = createId();
    await globalThis.prisma.file.upsert({
      where: {
        id: existing?.id ?? newId,
      },
      create: {
        id: newId,
        user: { connect: { id: this.context.user.id } },
        chat: { connect: { id: this.context.chat!.id } },
        ...(uri.uploadId ? { upload: { connect: { id: uri.uploadId } } } : {}),
        path: uri.path,
        data: Buffer.from(data),
        mime: await mimeType(data, uri.path.slice(-1)[0], 'text/plain'),
      },
      update: {
        data: Buffer.from(data),
        mime: await mimeType(data, uri.path.slice(-1)[0], existing?.mime ?? 'text/plain'),
        createdAt: new Date(),
      },
    });
  }

  async appendFile(
    path: string,
    content: FileContent,
    options?: { encoding?: BufferEncoding } | BufferEncoding,
  ) {
    console.log(`appendFile(${path})`);

    const uri = fromChatUri(path, this.basePath);
    if (!uri) throw new Error('ENOENT: invalid path');

    const encoding = typeof options === 'string' ? options : options?.encoding;
    const data = toBuffer(content, encoding);

    let source: File | null;
    try {
      source = await this.getFile(path);
    } catch {
      source = null;
    }

    const existing = await globalThis.prisma.file.findFirst({
      where: {
        userId: this.context.user.id,
        uploadId: uri.uploadId ?? null,
        chatId: this.context.chat!.id,
        path: { equals: uri.path ?? [] },
      },
    });

    const newId = createId();
    const newData = Buffer.concat([source?.data ?? Buffer.alloc(0), data]);
    await globalThis.prisma.file.upsert({
      where: {
        id: existing?.id ?? newId,
      },
      create: {
        id: newId,
        user: { connect: { id: this.context.user.id } },
        chat: { connect: { id: this.context.chat!.id } },
        ...(uri.uploadId ? { upload: { connect: { id: uri.uploadId } } } : {}),
        data: newData,
        mime: await mimeType(data, uri.path.slice(-1)[0], 'text/plain'),
      },
      update: {
        data: newData,
        mime: await mimeType(data, uri.path.slice(-1)[0], existing?.mime ?? 'text/plain'),
        createdAt: new Date(),
      },
    });
  }

  async exists(path: string): Promise<boolean> {
    console.log(`exists(${path})`);

    if (path === '/' || path === '/mnt') return true;

    const uri = fromChatUri(path, this.basePath);
    if (!uri) return false;

    const { exact, hasDeeper } = this.locate(this.fullPath(uri));
    const result = !!exact || hasDeeper;
    console.log(result);
    return Promise.resolve(result);
  }

  async stat(path: string): Promise<FsStat> {
    console.log(`stat(${path})`);

    if (path === '/' || path === '/mnt' || path === '/tmp') {
      return {
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
        mode: 0o755,
        size: 0,
        mtime: new Date(0),
      };
    }

    const uri = fromChatUri(path, this.basePath);
    if (!uri) throw new Error('ENOENT: invalid path');

    const fullPath = this.fullPath(uri);
    const { exact, hasDeeper } = this.locate(fullPath);

    // A path is a file if it exists at all (and isn't the synthetic root); it's a
    // directory if other, deeper paths exist within it (or it's flagged as one).
    if (exact && !exact.isDirectory) {
      const file = await this.getFile(path);
      const result = {
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        mode: 0o755,
        size: file.data.byteLength,
        mtime: file.createdAt,
      };
      console.log(result);
      return result;
    }

    if (hasDeeper || exact?.isDirectory) {
      const mtime = this.allPaths
        .filter((f) => pathStartsWith(f.path, fullPath))
        .map((f) => f.createdAt);
      mtime.sort((a, b) => b.getTime() - a.getTime());
      const result = {
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
        mode: 0o755,
        size: 0,
        mtime: mtime[0] ?? new Date(0),
      };
      console.log(result);
      return result;
    }

    throw new Error('ENOENT: no such file or directory');
  }

  async lstat(path: string): Promise<FsStat> {
    console.log(`lstat(${path})`);
    const result = await this.stat(path);
    console.log(result);
    return result;
  }

  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    console.log(`mkdir(${_path})`);
    return Promise.resolve();
  }

  async readdir(path: string): Promise<string[]> {
    console.log(`readdir(${path})`);
    const entries = await this.readdirWithFileTypes(path);
    const result = entries.map((e) => e.name);
    console.log(result);
    return result;
  }

  async readdirWithFileTypes(path: string) {
    console.log(`readdirWithFileTypes(${path})`);

    if (path === '/') {
      return [
        {
          name: 'mnt',
          isFile: false,
          isDirectory: true,
          isSymbolicLink: false,
          mtime: new Date(0),
        },
      ];
    }

    if (path === '/mnt') {
      return [
        {
          name: 'chat',
          isFile: false,
          isDirectory: true,
          isSymbolicLink: false,
          mtime: new Date(0),
        },
      ];
    }

    const uri = fromChatUri(path, this.basePath);
    if (!uri) throw new Error('ENOENT: invalid path');

    const basePath = this.fullPath(uri);

    // Collect the immediate child name of every known path nested under `basePath`,
    // tracking the most recent mtime seen among its descendants.
    const names = new Map<string, Date>();
    for (const f of this.allPaths) {
      if (f.path.length <= basePath.length || !pathStartsWith(f.path, basePath)) continue;
      const name = f.path[basePath.length];
      const mtime = names.get(name);
      if (!mtime || f.createdAt > mtime) names.set(name, f.createdAt);
    }

    const result = [...names]
      .filter(([name]) => shouldIncludeFile([...basePath, name].join('/'), true))
      .map(([name, mtime]) => {
        const childPath = [...basePath, name];
        const isDirectory = this.allPaths.some(
          (f) => f.path.length > childPath.length && pathStartsWith(f.path, childPath),
        );
        return {
          name,
          isFile: !isDirectory,
          isDirectory,
          isSymbolicLink: false,
          mtime,
        };
      });
    console.log(result);
    return Promise.resolve(result);
  }

  async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    console.log(`rm(${path})`);

    const uri = fromChatUri(path, this.basePath);
    if (!uri) {
      if (options?.force) return;
      throw new Error('ENOENT: invalid path');
    }

    const fullPath = this.fullPath(uri);
    const { exact, hasDeeper } = this.locate(fullPath);

    if (!exact && !hasDeeper) {
      if (options?.force) return;
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }

    // A direct file target is always subject to the chat-ownership check: files copied
    // from (read-only) uploads shadow the original but can't delete it out from under it.
    if (exact && !exact.isDirectory) {
      if (exact.chatId !== this.context.chat!.id) {
        throw new Error(`EACCES: permission denied, unlink '${path}'`);
      }
      await globalThis.prisma.file.deleteMany({
        where: {
          userId: this.context.user.id,
          chatId: this.context.chat!.id,
          uploadId: exact.uploadId,
          path: { equals: uri.path },
        },
      });
      return;
    }

    if (!options?.recursive) {
      throw new Error(`EISDIR: illegal operation on a directory, rm '${path}'`);
    }

    // Recursively remove only the chat-owned files under this path; any (read-only)
    // original upload files nested within are silently left in place.
    const targets = this.allPaths.filter(
      (f) =>
        !f.isDirectory && pathStartsWith(f.path, fullPath) && f.chatId === this.context.chat!.id,
    );

    if (targets.length) {
      await globalThis.prisma.file.deleteMany({
        where: {
          userId: this.context.user.id,
          chatId: this.context.chat!.id,
          OR: targets.map((t) => ({
            uploadId: t.uploadId,
            path: { equals: t.uploadId ? t.path.slice(1) : t.path },
          })),
        },
      });
    }
  }

  async cp(src: string, dest: string, options?: { recursive?: boolean }): Promise<void> {
    console.log(`cp(${src}, ${dest})`);

    const srcUri = fromChatUri(src, this.basePath);
    if (!srcUri) throw new Error('ENOENT: invalid path');

    const srcFullPath = this.fullPath(srcUri);
    const { exact, hasDeeper } = this.locate(srcFullPath);

    if (exact && !exact.isDirectory) {
      const srcFile = await this.getFile(src);
      await this.writeFile(dest, srcFile.data);
      return;
    }

    if (!hasDeeper) throw new Error(`ENOENT: no such file or directory: ${src}`);
    if (!options?.recursive) {
      throw new Error(`EISDIR: illegal operation on a directory, cp '${src}'`);
    }

    const destUri = fromChatUri(dest, this.basePath);
    if (!destUri) throw new Error('ENOENT: invalid path');
    const destFullPath = [...destUri.path];

    const files = this.allPaths.filter(
      (f) => !f.isDirectory && pathStartsWith(f.path, srcFullPath),
    );

    for (const f of files) {
      const relative = f.path.slice(srcFullPath.length);
      const childSrc = toChatUri(f.uploadId, f.uploadId ? f.path.slice(1) : f.path, this.basePath);
      const childDest = toChatUri(destUri.uploadId, [...destFullPath, ...relative], this.basePath);
      const srcFile = await this.getFile(childSrc);
      await this.writeFile(childDest, srcFile.data);
    }
  }

  async mv(src: string, dest: string): Promise<void> {
    console.log(`mv(${src}, ${dest})`);
    await this.cp(src, dest, { recursive: true });
    await this.rm(src, { recursive: true });
  }

  async symlink(_target: string, _linkPath: string): Promise<void> {
    console.log(`symlink(${_target}, ${_linkPath})`);
    return Promise.reject(new Error('ENOENT: operation not supported'));
  }

  async link(_target: string, _linkPath: string): Promise<void> {
    console.log(`link(${_target}, ${_linkPath})`);
    return Promise.reject(new Error('ENOENT: operation not supported'));
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
    console.log('getAllPaths()');
    const result = this.allPaths
      .filter((f) => f.path.length > 0)
      .map((f) => toChatUri(f.uploadId, f.uploadId ? f.path.slice(1) : f.path));
    console.log(result);
    return result;
  }

  resolvePath(base: string, path: string): string {
    console.log(`resolvePath(${base}, ${path})`);
    const result = resolvePath(base, path);
    console.log(result);
    return result;
  }
}

function fromBuffer(buffer: Uint8Array, encoding?: BufferEncoding | null): string {
  if (encoding === 'base64') {
    // Use chunked String.fromCharCode to avoid RangeError on large buffers.
    // The spread operator (...buffer) creates one argument per byte and crashes
    // on buffers larger than ~100KB due to call stack limits.
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(buffer).toString('base64');
    }
    const chunkSize = 65536;
    let binary = '';
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }
  if (encoding === 'hex') {
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  if (encoding === 'binary' || encoding === 'latin1') {
    // Use Buffer if available (Node.js) - much more efficient and avoids spread operator limits
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(buffer).toString(encoding);
    }

    // Browser fallback - String.fromCharCode(...buffer) fails with buffers > ~100KB
    const chunkSize = 65536; // 64KB chunks
    if (buffer.length <= chunkSize) {
      return String.fromCharCode(...buffer);
    }
    let result = '';
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

  if (encoding === 'base64') {
    return Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
  }
  if (encoding === 'hex') {
    const bytes = new Uint8Array(content.length / 2);
    for (let i = 0; i < content.length; i += 2) {
      bytes[i / 2] = parseInt(content.slice(i, i + 2), 16);
    }
    return bytes;
  }
  if (encoding === 'binary' || encoding === 'latin1') {
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
  if (!path || path === '/') return '/';

  let normalized = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  const parts = normalized.split('/').filter((p) => p && p !== '.');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return `/${resolved.join('/')}`;
}

function resolvePath(base: string, path: string): string {
  base = base.replace('/mnt/chat', '');
  if (path.startsWith('/')) {
    return `/mnt/chat${normalizePath(path)}`;
  }
  const combined = base === '/' ? `/${path}` : `${base}/${path}`;
  return `/mnt/chat${normalizePath(combined)}`;
}
