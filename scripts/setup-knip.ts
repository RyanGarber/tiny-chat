import type { Preprocessor } from "knip";

export default ((options) => {
	for (const [, issues] of Object.entries(options.issues.exports)) {
		for (const [id, issue] of Object.entries(issues)) {
			if (
				issue.symbol.endsWith("QueryKey") ||
				issue.symbol.endsWith("MutationKey")
			) {
				delete issues[id];
			}
		}
	}
	return options;
}) satisfies Preprocessor;
