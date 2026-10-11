import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import library from "#cli/core/services/AFMLibrary.ts";
import { AFMLibraryService } from "#client/features/provider/services/AFMLibraryService.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { createAFMProvider } from "#core/features/provider/providers/model/AFMProvider.ts";
import type { ModelProvider } from "#core/features/provider/types/model.ts";

/**
 * The embedded library's path: absolute in a compiled binary (its own virtual
 * file system), relative to the bundle in `dist/`.
 */
const resolve = (library: string) =>
	isAbsolute(library)
		? library
		: fileURLToPath(new URL(library, import.meta.url));

let provider: Promise<ModelProvider<any> | null> | undefined;

export const AFMService = {
	/**
	 * Apple Foundation Models, if afmize was built into the CLI and loads here.
	 */
	getProvider: (): Promise<ModelProvider<any> | null> =>
		(provider ??= (async () => {
			if (!library || process.platform !== "darwin" || !process.versions.bun)
				return null;

			// Fails on a macOS too old for FoundationModels (or the symbols afmize
			// was built against), which only leaves AFM out.
			try {
				return createAFMProvider(
					await AFMLibraryService.open(resolve(library)),
				);
			} catch (error) {
				// Outside development, stderr would draw over the UI.
				if (CommonUtils.isTruthy(process.env.DEV))
					console.warn("[AFMService] failed to load afmize", error);
				return null;
			}
		})()),
};
