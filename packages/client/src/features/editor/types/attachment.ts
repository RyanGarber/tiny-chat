import type { CompletionGroup, CompletionItem } from "./completion.ts";

export interface AttachmentItem extends CompletionItem {
	directory?: boolean;
	traversable?: boolean;
}

export interface AttachmentGroup extends CompletionGroup<AttachmentItem> {}

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
