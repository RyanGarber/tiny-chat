import { distance } from "fastest-levenshtein";
import { customAlphabet } from "nanoid";
import type { Temporal } from "temporal-polyfill";
import { format } from "timeago.js";
import {
	adjectives,
	colors,
	uniqueNamesGenerator,
} from "unique-names-generator";
import { RRule } from "../../index.ts";
import { ID_ALPHABET, ID_LENGTH } from "../types/common.ts";

type MaybeNullish<TIn, TOut> = TIn extends undefined
	? undefined
	: TIn extends null
		? null
		: TOut;

const getRandomName = () => {
	return uniqueNamesGenerator({
		dictionaries: [adjectives, colors],
		length: 2,
		style: "capital",
		separator: " ",
	});
};

const getRandomId = customAlphabet(ID_ALPHABET, ID_LENGTH);

export const CommonUtils = {
	endpoints: {
		api: "/@/api",
		auth: "/@/auth",
		mcp: "/@/mcp",
		antigravity: "/@/antigravity",
	},

	isTruthy: (value?: string) => {
		return value === "true" || value === "1";
	},

	defaultName: getRandomName(),

	getRandomName,

	getRandomId,

	getHash: (data: string) => {
		let hash = 5381;
		for (let i = 0; i < data.length; i++) {
			hash = (hash * 33) ^ data.charCodeAt(i);
		}
		return hash >>> 0;
	},

	toDate: <T extends Temporal.PlainDateTime | Date | null | undefined>(
		datetime?: T,
	): MaybeNullish<T, Date> => {
		if (!datetime) return datetime as MaybeNullish<T, Date>;
		if (datetime instanceof Date)
			return datetime as Date as MaybeNullish<T, Date>;
		return new Date(
			datetime.toZonedDateTime("UTC").epochMilliseconds,
		) as MaybeNullish<T, Date>;
	},

	formatDate: ({
		date = new Date(),
		timezone,
		relative = false,
	}: {
		date?: Date | Temporal.PlainDateTime;
		timezone?: string;
		relative?: boolean;
	}) => {
		date = CommonUtils.toDate(date) ?? new Date();
		return relative
			? format(date, timezone)
			: date.toLocaleString("en-US", {
					timeZone: timezone ?? "UTC",
					dateStyle: "long",
					timeStyle: "short",
				});
	},

	formatTimespan: ({ from, to }: { from: Date; to: Date }) => {
		if (from.getTime() > to.getTime()) {
			[from, to] = [to, from];
		}
		return format(from, undefined, { relativeDate: to }).replace(" ago", "");
	},

	formatError: ({ error, details }: { error?: unknown; details?: boolean }) => {
		if (details) {
			return error instanceof Error
				? `${error.name}: ${error.message}\n\nDetails: ${JSON.stringify(error)}`
				: JSON.stringify(error);
		}
		return error instanceof Error
			? `${error.name}: ${error.message}`
			: String(error);
	},

	escapeRegex: (value: string) => {
		return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	},

	escapeQuery: (value: string) => {
		return value
			.replace(/["“”]/g, " ")
			.replace(/\bor\b/gi, " ")
			.replace(/(^|\s)-+/g, " $1".trim())
			.replace(/\s+/g, " ")
			.trim();
	},

	toStyleObject: (styleString: string): Record<string, string> => {
		const style: Record<string, string> = {};
		for (const decl of styleString.split(";")) {
			const index = decl.indexOf(":");
			if (index > 0) {
				const prop = decl.slice(0, index).trim();
				const val = decl.slice(index + 1).trim();
				if (prop && val) {
					style[prop] = val;
				}
			}
		}
		return style;
	},

	toStyleString: (style: Record<string, string>): string => {
		return Object.keys(style).reduce((accumulator, key) => {
			const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
			return `${accumulator}${cssKey}:${style[key]};`;
		}, "");
	},

	toAttributesObject: (attributeString?: string): Record<string, any> => {
		if (!attributeString?.trim()) {
			return {};
		}

		const attributes: Record<string, any> = {};
		const regex = /([a-zA-Z0-9-]+)=(?:"([^"]*)"|'([^']*)'|(\S*))/g;
		let match = regex.exec(attributeString);

		while (match !== null) {
			const [, key, doubleQuoted, singleQuoted, unquoted] = match;
			attributes[key] = doubleQuoted || singleQuoted || unquoted;
			match = regex.exec(attributeString);
		}

		return attributes;
	},

	toAttributesString: (attributes: Record<string, any>): string => {
		return Object.entries(attributes)
			.filter(([, value]) => value !== undefined && value !== null)
			.map(([key, value]) => `${key}="${value}"`)
			.join(" ");
	},

	getScheduled: ({
		rrule,
		after,
	}: {
		rrule: { schedule: string } | string;
		after?: Date | null;
	}): Date | null => {
		if (typeof rrule === "string") rrule = { schedule: rrule };

		const schedule = RRule.fromString(rrule.schedule);
		const startAt = schedule.options.dtstart;
		const searchFrom = after ?? new Date(startAt.getTime() - 1);

		return schedule.after(searchFrom, false);
	},

	getDistance: (a: string, b: string) => {
		const length = Math.max(a.length, b.length);
		const score = distance(a, b);
		return length > 0 ? score / length : 0;
	},
} as const;
