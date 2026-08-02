export type DiffLine =
	| { type: "add" | "remove" | "context"; value: string }
	| { type: "gap"; count: number };

/** Above this many cells the diff table is not worth building. */
const MAX_CELLS = 4_000_000;

const toLines = (text: string) => {
	const lines = text.split("\n");
	if (lines.at(-1) === "") lines.pop();
	return lines;
};

export const DiffUtils = {
	/**
	 * Line diff between two texts, longest common subsequence based.
	 */
	getLines: ({ before, after }: { before: string; after: string }) => {
		const removed = toLines(before);
		const added = toLines(after);

		const n = removed.length;
		const m = added.length;

		if ((n + 1) * (m + 1) > MAX_CELLS) {
			return [
				...removed.map((value): DiffLine => ({ type: "remove", value })),
				...added.map((value): DiffLine => ({ type: "add", value })),
			];
		}

		const width = m + 1;
		const table = new Int32Array((n + 1) * width);

		for (let i = n - 1; i >= 0; i--) {
			for (let j = m - 1; j >= 0; j--) {
				table[i * width + j] =
					removed[i] === added[j]
						? table[(i + 1) * width + j + 1] + 1
						: Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
			}
		}

		const lines: DiffLine[] = [];
		let i = 0;
		let j = 0;

		while (i < n && j < m) {
			if (removed[i] === added[j]) {
				lines.push({ type: "context", value: removed[i] });
				i++;
				j++;
			} else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
				lines.push({ type: "remove", value: removed[i] });
				i++;
			} else {
				lines.push({ type: "add", value: added[j] });
				j++;
			}
		}

		while (i < n) lines.push({ type: "remove", value: removed[i++] });
		while (j < m) lines.push({ type: "add", value: added[j++] });

		return lines;
	},

	/**
	 * Replaces long runs of unchanged lines with a gap.
	 */
	collapse: ({
		lines,
		context = 3,
	}: {
		lines: DiffLine[];
		context?: number;
	}) => {
		const kept = lines.map((line) => line.type !== "context");

		lines.forEach((line, index) => {
			if (line.type === "context" || line.type === "gap") return;
			const start = Math.max(index - context, 0);
			const end = Math.min(index + context, lines.length - 1);
			for (let i = start; i <= end; i++) kept[i] = true;
		});

		const collapsed: DiffLine[] = [];
		let gap = 0;

		for (let index = 0; index < lines.length; index++) {
			if (!kept[index]) {
				gap++;
				continue;
			}
			if (gap) {
				collapsed.push({ type: "gap", count: gap });
				gap = 0;
			}
			collapsed.push(lines[index]);
		}

		if (gap) collapsed.push({ type: "gap", count: gap });

		return collapsed;
	},
} as const;
