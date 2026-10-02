import type { CompletionGroup, CompletionItem } from "./completion.ts";

export interface AttachmentItem extends CompletionItem {
	directory?: boolean;
	traversable?: boolean;
	/**
	 * What the query becomes on traversing into this, when its name is not what
	 * the path calls it. An upload sits under its id but reads as its name, so
	 * continuing into one has to be told where it actually is.
	 */
	path?: string;
	/**
	 * What the attachment reads as, when its path does not say. An upload is
	 * mounted under its id, so the name it was attached under travels with it.
	 */
	label?: string;
}

export interface AttachmentGroup extends CompletionGroup<AttachmentItem> {
	/**
	 * Already matched against the query, and ranked, by whoever built the
	 * group. A search over whole paths finds items whose name alone would not
	 * match, so filtering them again by name would throw those away.
	 */
	matched?: boolean;
}

/**
 * An attachment being typed in a plain text buffer, up to the cursor.
 */
export interface AttachmentQuery {
	/** the path being completed, without its leading `@` */
	text: string;
	/** offset of the leading `@` */
	from: number;
	/** offset of the cursor */
	to: number;
}
