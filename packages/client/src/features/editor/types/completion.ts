export interface CompletionItem {
	name?: string;
	value: string;
	active?: boolean;
}

export interface CompletionGroup<T extends CompletionItem = CompletionItem> {
	name?: string;
	items: T[];
}
