import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import {
	type FileCategory,
	FileExcludeUtils,
} from "@tiny-chat/core/src/features/file/utils/FileExcludeUtils.ts";
import { Prisma } from "../../../../generated/prisma/client.ts";

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
	shouldIncludeFileSql: ({ extras = true }: { extras?: boolean } = {}) => {
		const categories = getCategories(extras);
		const path = Prisma.sql`array_to_string(path, '/')`;

		/** One "does not match" clause, or nothing when there is nothing to say. */
		const excluding = (
			alternatives: string[],
			{ prefix, suffix }: { prefix: string; suffix: string },
		) =>
			alternatives.length
				? [
						Prisma.sql`${path} !~* ${`${prefix}(${alternatives
							.map(CommonUtils.escapeRegex)
							.join("|")})${suffix}`}`,
					]
				: [];

		const clauses = [
			...excluding(
				FileExcludeUtils.getNames({ categories, directoryOnly: false }),
				{ prefix: "(^|/)", suffix: "(/|$)" },
			),
			// Every row here is a file, so a name that only counts as a directory
			// must be followed by a slash, or a script called `build` would be
			// dropped along with the directory of the same name.
			...excluding(
				FileExcludeUtils.getNames({ categories, directoryOnly: true }),
				{ prefix: "(^|/)", suffix: "/" },
			),
			...excluding(FileExcludeUtils.getExtensions({ categories }), {
				prefix: "\\.",
				suffix: "$",
			}),
		];

		return clauses.length ? Prisma.join(clauses, " AND ") : Prisma.sql`TRUE`;
	},
} as const;
