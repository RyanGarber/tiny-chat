export function assertExists<T>(
	item: T,
	description: string,
): asserts item is NonNullable<T> {
	if (!item)
		throw new Error(`Missing required context for tool: ${description}`);
}
