import {
	adjectives,
	colors,
	uniqueNamesGenerator,
} from "unique-names-generator";
import { RRule } from "../../index.ts";

const getRandomName = () => {
	return uniqueNamesGenerator({
		dictionaries: [adjectives, colors],
		length: 2,
		style: "capital",
		separator: " ",
	});
};

export const CommonUtils = {
	defaultName: getRandomName(),

	getRandomName,

	getDateFormatted: ({
		date = new Date(),
		timezone,
	}: {
		date?: Date;
		timezone?: string;
	}) => {
		return date.toLocaleString("en-US", {
			timeZone: timezone ?? "UTC",
			dateStyle: "long",
			timeStyle: "short",
		});
	},

	getErrorFormatted: ({ error }: { error?: unknown }) => {
		return error instanceof Error
			? `${error.name}: ${error.message}`
			: String(error);
	},

	getRegexEscaped: (value: string) => {
		return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
	}) => {
		if (typeof rrule === "string") rrule = { schedule: rrule };

		const schedule = RRule.fromString(rrule.schedule);
		const startAt = schedule.options.dtstart;
		const searchFrom = after ?? new Date(startAt.getTime() - 1);

		return schedule.after(searchFrom, false);
	},
} as const;
