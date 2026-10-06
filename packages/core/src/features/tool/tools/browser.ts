import type { BrowserCapability } from "#core/core/types/capability.ts";
import { createBrowserTool } from "#core/features/tool/tools/browser/browser.ts";
import type {
	Toolset,
	ToolsetFactory,
} from "#core/features/tool/types/tool.ts";

/**
 * Valid only once the host has found Playwright and a browser to launch, so
 * the toolset carries the reason it cannot run rather than failing on use.
 */
export const createBrowserToolset: ToolsetFactory<
	Toolset<{ browser: BrowserCapability }>
> = async (options) => {
	let status = options.status;
	if (status.valid) {
		const browser = await options.capabilities.browser
			.status()
			.catch((error: unknown) => ({
				available: false,
				error: error instanceof Error ? error.message : String(error),
			}));
		status = browser.available
			? status
			: { valid: false, error: browser.error ?? "No browser available" };
	}

	return {
		name: "browser",
		tools: [await createBrowserTool(options)],
		...options,
		status,
	};
};
