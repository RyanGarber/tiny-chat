/**
 * Where afmize's dynamic library is, when the CLI was built with it.
 * `scripts/compile.ts` replaces this module with one that embeds the library
 * — in the binary itself, or beside the bundle in development — and exports
 * its path; built without it, there is none.
 */
const library: string | null = null;

export default library;
