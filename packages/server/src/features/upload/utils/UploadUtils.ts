import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { FileExtractionService } from "@tiny-chat/core/src/features/file/services/FileExtractionService.ts";
import {
	type FileCategory,
	FileExcludeUtils,
} from "@tiny-chat/core/src/features/file/utils/FileExcludeUtils.ts";

/**
 * What is worth keeping out of an upload, expressed in terms of the one set of
 * rules the agent's file tools already use.
 *
 * Storing a file and searching a file are different questions with the same
 * answer at the edges: a `.git` object store or a `node_modules` tree is
 * neither worth the rows nor worth the read. So the full filter here is the
 * search scope, borrowed wholesale — if no search would ever open it, nothing
 * downstream can use it either.
 *
 * `extras: false` keeps that restraint for uploads the user assembled by hand,
 * where the only safe assumption is that they meant to send what they sent.
 */

/** Debris no upload should carry, whatever it is an upload of. */
const JUNK = new Set<FileCategory>(["junk"]);

const getCategories = (extras: boolean) =>
	extras ? FileExcludeUtils.getScope("search") : JUNK;

export const UploadUtils = {
	shouldIncludeFile: ({
		path,
		extras = true,
	}: {
		path: string[] | string;
		/** Apply the full storage filter rather than only dropping OS debris. */
		extras?: boolean;
	}) => {
		const category = FileExcludeUtils.getCategory({
			path: typeof path === "string" ? path : path.join("/"),
		});
		return !category || !getCategories(extras).has(category);
	},

	excluding: ({
		column,
		alternatives,
		prefix,
		suffix,
	}: {
		column: any;
		alternatives: string[];
		prefix: string;
		suffix: string;
	}) => {
		if (!alternatives.length) return [];
		const pattern = `${prefix}(${alternatives.map(CommonUtils.escapeRegex).join("|")})${suffix}`;
		return [
			globalThis.db.raw
				.sql`array_to_string(${column}, '/') !~* ${pattern}`.returns(
				"pg/bool@1",
			),
		];
	},

	/**
	 * The same test in SQL, for choosing which stored files to embed.
	 *
	 * Two case-insensitive regular expressions rather than a few hundred
	 * `ILIKE` patterns: it is one pass instead of one per name, and `_` means
	 * an underscore here, where in `LIKE` it would quietly match anything and
	 * let `nodeXmodules` through.
	 *
	 * Only the name-based half of the filter survives the translation, which is
	 * enough — the caller pairs it with a size bound and a decodability check,
	 * and those catch what a path cannot say.
	 */
	shouldIncludeFileSql: (
		column: any,
		{
			extras = true,
		}: {
			extras?: boolean;
		} = {},
	) => {
		const categories = getCategories(extras);
		return [
			...UploadUtils.excluding({
				column,
				alternatives: FileExcludeUtils.getNames({
					categories,
					directoryOnly: false,
				}),

				prefix: "(^|/)",
				suffix: "(/|$)",
			}),
			...UploadUtils.excluding({
				column,
				alternatives: FileExcludeUtils.getNames({
					categories,
					directoryOnly: true,
				}),
				prefix: "(^|/)",
				suffix: "/",
			}),
			...UploadUtils.excluding({
				column,
				alternatives: FileExcludeUtils.getExtensions({ categories }),
				prefix: "\\.",
				suffix: "$",
			}),
		];
	},

	/**
	 * Whether a stored file is one of the container formats that has to be
	 * unpacked before there is any text to read. Such a file never decodes as
	 * UTF-8, so anything selecting rows on that alone has to ask this too.
	 */
	isDocumentSql: (column: any) => {
		const extensionPattern = `\\.(${[...FileExtractionService.formats]
			.map(CommonUtils.escapeRegex)
			.join("|")})$`;

		return globalThis.db.raw
			.sql`array_to_string(${column}, '/') ~* ${extensionPattern}`.returns(
			"pg/bool@1",
		);
	},
} as const;
