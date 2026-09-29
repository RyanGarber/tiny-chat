import { z } from "zod";

export const ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const ID_LENGTH = 12;
export const zId = z.union([
	z.stringFormat("zId", new RegExp(`^[${ID_ALPHABET}]{${ID_LENGTH}}$`)),
	z.cuid2(),
]);
export type zId = z.infer<typeof zId>;

export const zStringify = z
	.union([z.string(), z.number(), z.boolean()])
	.transform((value) => String(value));
export type zStringify = z.infer<typeof zStringify>;

export type DistributiveOmit<T, K extends keyof any> = T extends any
	? Omit<T, K>
	: never;

/** @lintignore */
export type CleanOmit<T, K extends PropertyKey> = {
	[P in keyof T as P extends K ? never : P]: T[P];
};

export type PromiseOr<T, P = void> = T | ((params: P) => PromiseOrValue<T>);

export type PromiseOrValue<T> = Promise<T> | T;

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** What a value looks like while it is still being streamed in. */
export type DeepPartial<T> = T extends (infer U)[]
	? DeepPartial<U>[]
	: T extends Date
		? T
		: T extends object
			? { [K in keyof T]?: DeepPartial<T[K]> }
			: T;
