import { create } from "zustand";
import type { RenderedPart } from "#core/features/data/utils/DataUtils.ts";
import type { Toolset } from "#core/features/tool/types/tool.ts";

export type ShellRun = Extract<RenderedPart, { type: "toolCall" }>;

interface ShellStore {
	/**
	 * The last command typed in with `!`, as the same tool call the model would
	 * have made to run it, so it is drawn the way any other call is.
	 */
	run: ShellRun | null;
	/** The toolsets its display is looked up in. */
	toolsets: Toolset<any>[];
	setRun: (run: ShellRun | null, toolsets?: Toolset<any>[]) => void;
}

export const useShellStore = create<ShellStore>((set) => ({
	run: null,
	toolsets: [],
	setRun: (run, toolsets) =>
		set((state) => ({ run, toolsets: toolsets ?? state.toolsets })),
}));
