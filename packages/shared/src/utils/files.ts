import { Mime } from 'mime';
import standardTypes from 'mime/types/standard.js';
import otherTypes from 'mime/types/other.js';
import { fileTypeFromStream } from 'file-type';

const mime = new Mime(standardTypes, otherTypes);

mime.define({ 'text/typescript': ['ts', 'tsx', 'mts', 'cts'] }, true);
mime.define({ 'text/x-objcppsrc': ['mm'] }, true);
mime.define({ 'text/org': ['org'] }, true);
mime.define({ 'text/x-asciidoc': ['adoc', 'asciidoc', 'asc'] }, true);
mime.define({ 'text/x-rustsrc': ['rs'] }, true);
mime.define({ 'text/x-go': ['go'] }, true);
mime.define({ 'text/x-swift': ['swift'] }, true);
mime.define({ 'application/dart': ['dart'] }, true);
mime.define({ 'text/x-zig': ['zig', 'zon'] }, true); // .zon = Zig package manifest
mime.define({ 'text/x-nim': ['nim', 'nims', 'nimble'] }, true);
mime.define({ 'text/x-crystal': ['cr'] }, true);
mime.define({ 'text/x-d': ['d', 'di'] }, true); // .di = D interface file
mime.define({ 'text/x-odin': ['odin'] }, true);
mime.define({ 'text/x-verilog': ['v', 'vh', 'sv', 'svh'] }, true);
mime.define({ 'text/x-kotlin': ['kt', 'kts'] }, true);
mime.define({ 'text/x-scala': ['scala', 'sc'] }, true);
mime.define({ 'text/x-groovy': ['groovy', 'gvy', 'gy', 'gradle'] }, true);
mime.define({ 'text/x-haskell': ['hs', 'lhs'] }, true);
mime.define({ 'text/x-ocaml': ['ml', 'mli', 'mly', 'mll'] }, true);
mime.define({ 'text/x-fsharp': ['fs', 'fsi', 'fsx', 'fsscript'] }, true);
mime.define({ 'text/x-elixir': ['ex', 'exs', 'heex', 'leex'] }, true);
mime.define({ 'text/x-erlang': ['erl', 'hrl', 'escript'] }, true);
mime.define({ 'text/x-clojure': ['clj', 'cljs', 'cljc', 'edn'] }, true);
mime.define({ 'text/x-elm': ['elm'] }, true);
mime.define({ 'text/x-purescript': ['purs'] }, true);
mime.define({ 'text/x-julia': ['jl'] }, true);
mime.define({ 'text/x-lua': ['lua'] }, true);
mime.define({ 'text/x-r': ['r', 'rmd', 'rnw', 'rprofile'] }, true); // .R handled by case-insensitive FS
mime.define({ 'text/coffeescript': ['coffee', 'litcoffee'] }, true);
mime.define({ 'text/x-perl': ['pl', 'pm', 'pod', 'psgi'] }, true);
mime.define({ 'text/x-ruby': ['rb', 'rake', 'gemspec', 'ru'] }, true);
mime.define({ 'text/x-python': ['py', 'pyi', 'pyw', 'pyx', 'pxd'] }, true); // .py already mapped
mime.define({ 'text/x-vue': ['vue'] }, true);
mime.define({ 'text/x-svelte': ['svelte'] }, true);
mime.define({ 'text/x-astro': ['astro'] }, true);
mime.define({ 'text/mdx': ['mdx'] }, true);
mime.define({ 'application/graphql': ['graphql', 'gql'] }, true);
mime.define({ 'text/x-scss': ['scss'] }, true);
mime.define({ 'text/x-sass': ['sass'] }, true);
mime.define({ 'text/x-less': ['less'] }, true);
mime.define({ 'text/x-stylus': ['styl'] }, true);
mime.define({ 'application/toml': ['toml'] }, true); // RFC 9512
mime.define({ 'application/jsonc': ['jsonc'] }, true);
mime.define({ 'application/x-ndjson': ['jsonl', 'ndjson'] }, true);
mime.define({ 'text/x-prisma': ['prisma'] }, true);
mime.define({ 'text/x-terraform': ['tf', 'tfvars'] }, true);
mime.define({ 'text/x-hcl': ['hcl'] }, true);
mime.define({ 'text/x-nix': ['nix'] }, true);
mime.define({ 'text/x-bicep': ['bicep'] }, true);
mime.define({ 'text/x-dockerfile': ['dockerfile'] }, true); // for explicit .dockerfile files
mime.define({ 'application/x-powershell': ['ps1', 'psm1', 'psd1', 'ps1xml'] }, true);
mime.define(
  {
    'text/x-shellscript': [
      'bash',
      'bashrc',
      'bash_profile',
      'zsh',
      'zshrc',
      'zprofile',
      'fish',
      'ksh',
      'csh',
      'tcsh',
    ],
  },
  true,
); // .sh already mapped
mime.define({ 'text/x-dotenv': ['env'] }, true);
mime.define({ 'text/x-arduino': ['ino'] }, true);
mime.define({ 'text/x-processing': ['pde'] }, true);
mime.define({ 'text/x-solidity': ['sol'] }, true);
mime.define({ 'text/x-vyper': ['vy'] }, true);
mime.define({ 'text/x-cairo': ['cairo'] }, true);
mime.define({ 'text/x-lean': ['lean'] }, true);
mime.define({ 'text/x-agda': ['agda'] }, true);
mime.define({ 'text/x-idris': ['idr', 'lidr'] }, true);
mime.define({ 'text/x-rst': ['rst', 'rest'] }, true);

function ensureBytes(data: Uint8Array | string) {
  if (typeof data === 'string') {
    const binary = atob(data);
    data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      data[i] = binary.charCodeAt(i);
    }
  }
  return data;
}

export async function mimeType(data: Uint8Array | string, filename?: string, fallback?: string) {
  filename = filename?.toLowerCase().split('/').slice(-1)[0];
  data = ensureBytes(data);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  return (
    (await fileTypeFromStream(stream))?.mime ??
    mimeTypeFromExtension(filename) ??
    fallback ??
    'application/octet-stream'
  );
}

export function mimeTypeFromExtension(filename?: string) {
  return filename ? mime.getType(filename) : undefined;
}

export function mimeExtension(mimeType: string, filename?: string) {
  return mime.getExtension(mimeType) ?? filename?.split('.').pop() ?? '';
}

const TEXT_MIMES = new Set([
  'application/json',
  'application/jsonc',
  'application/x-ndjson',
  'application/xml',
  'application/xhtml+xml',
  'application/javascript', // legacy; text/javascript is now correct per RFC 9239
  'application/ecmascript',
  'application/typescript',
  'application/toml', // RFC 9512
  'application/graphql',
  'application/rtf',
  'application/x-sh',
  'application/x-csh',
  'application/x-powershell',
  'application/dart',
  'application/x-latex',
  'application/x-tex',
  'application/pgp-keys', // ASCII-armored, fully text
  'application/pgp-signature', // ASCII-armored
  'application/x-www-form-urlencoded',
  'application/sparql-query',
  'application/sparql-update',
]);

const TEXT_SUFFIXES = ['+json', '+xml', '+yaml', '+csv', '+turtle', '+ld+json'];

export function isTextAdjacent(mime: string) {
  const base = mime.split(';')[0].trim().toLowerCase();
  if (base.startsWith('text/')) return true;
  if (TEXT_MIMES.has(mime)) return true;
  if (TEXT_SUFFIXES.some((s) => base.endsWith(s))) return true; // application/ld+json, atom+xml, etc.
  return false;
}

function detectBOM(bytes: Uint8Array) {
  // UTF-32 must be checked before UTF-16 (same first two bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0x00 && bytes[3] === 0x00)
    return { encoding: 'utf-32le', skip: 4 };
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0xfe && bytes[3] === 0xff)
    return { encoding: 'utf-32be', skip: 4 };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return { encoding: 'utf-8', skip: 3 };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: 'utf-16le', skip: 2 };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: 'utf-16be', skip: 2 };
  return null;
}

export function decodeTextLossy(data: Uint8Array | string, mime: string) {
  data = ensureBytes(data);

  const charset = /;\s*charset\s*=\s*"?([^";]+)"?/i.exec(mime)?.[1]?.trim();
  if (charset) {
    try {
      return new TextDecoder(charset, { fatal: true }).decode(data.buffer);
    } catch {
      // ignore
    }
  }

  const bom = detectBOM(data);
  if (bom) {
    return new TextDecoder(bom.encoding).decode(data.buffer.slice(bom.skip));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data.buffer);
  } catch {
    // ignore
  }

  return new TextDecoder('windows-1252').decode(data.buffer);
}

export function toChatUri(uploadId?: string | null, path?: string[], basePath = '/mnt/chat/') {
  return `${basePath}${[uploadId, ...(path ?? [])].filter((p) => p?.length).join('/')}`;
}

export function fromChatUriOrThrow(uri: string, basePath = '/mnt/chat/') {
  const parsed = fromChatUri(uri, basePath);
  if (!parsed) throw new Error('Invalid uri: expected /mnt/chat uri');
  return parsed;
}

export function fromChatUri(uri: string, basePath = '/mnt/chat/') {
  if (!uri.startsWith(basePath)) return null;
  uri = uri.replace(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '');
  const path = uri.split('/').filter((part) => part.length);
  let uploadId: string | undefined;
  if (path[0]?.length === 24) {
    uploadId = path.shift()!;
  }
  return { uploadId, path };
}

export function pathIsChildOf(path: string[], isChildOf: string[] = []) {
  return (
    path
      .filter((part) => part.length)
      .slice(0, -1)
      .join('/') === isChildOf.filter((part) => part.length).join('/')
  );
}

export function pathStartsWith(path: string[], startsWith: string[] = []) {
  if (!startsWith?.length) return true;
  return `${path.filter((part) => part.length).join('/')}/`.startsWith(
    `${startsWith.filter((part) => part.length).join('/')}/`,
  );
}

export function pathEquals(a: string[], b: string[]) {
  return a.filter((part) => part.length).join('/') === b.filter((part) => part.length).join('/');
}

export function pathName(path?: string | string[]) {
  if (typeof path !== 'string') path = path?.join('/');
  if (!path?.length) return '';
  const uri = fromChatUri(path);
  if (uri === null)
    return (
      path
        .split('/')
        .filter((part) => part.length)
        .pop() ?? ''
    );
  return uri.path.pop() ?? '';
}
