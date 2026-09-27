import type { CompletionItem } from "../types/completion.ts";

const normalize = (value: string) => value.trim().toLowerCase();

const weight = ({ value, query }: { value: string; query: string }) => {
	if (!query) return [0, 0, 0] as const;

	const index = value.indexOf(query);
	if (index < 0) return null;

	return [
		value === query ? 0 : index === 0 ? 1 : 2,
		index,
		value.length,
	] as const;
};

export const CompletionUtils = {
	/**
	 * Keep only completion items containing `query`, ordered by how directly
	 * their displayed name matches it. The original order breaks ties so a
	 * caller's deliberate ordering remains intact.
	 */
	filter: <T extends CompletionItem>({
		items,
		query = "",
	}: {
		items: T[];
		query?: string;
	}): T[] => {
		const normalizedQuery = normalize(query);

		return items
			.map((item, order) => ({
				item,
				order,
				weight: weight({
					value: normalize(item.name ?? item.value),
					query: normalizedQuery,
				}),
			}))
			.filter(
				(
					entry,
				): entry is typeof entry & {
					weight: readonly [number, number, number];
				} => entry.weight !== null,
			)
			.sort((a, b) => {
				for (let index = 0; index < a.weight.length; index += 1) {
					const difference = a.weight[index] - b.weight[index];
					if (difference) return difference;
				}
				return a.order - b.order;
			})
			.map(({ item }) => item);
	},
} as const;
