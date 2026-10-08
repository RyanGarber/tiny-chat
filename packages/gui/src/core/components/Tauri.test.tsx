import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import Tauri from "#gui/core/components/Tauri.tsx";
import { useTauriStore } from "#gui/features/tauri/stores/useTauriStore.ts";
import { render } from "#gui/tests.ts";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	useTauriStore.setState({ tasks: {} });
});

it.each([false, true])(
	"removes a task at 100% (progress animation finished: %s)",
	async (finishProgress) => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		const frames = new Map<number, FrameRequestCallback>();
		let nextFrame = 0;
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frames.set(++nextFrame, callback);
			return nextFrame;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
			frames.delete(id);
		});

		await render(<Tauri />);
		await act(async () => {
			useTauriStore.getState().addTask("update", "Downloading update");
		});
		await act(async () => {
			void useTauriStore.getState().updateTask("update", 100);
		});
		expect(frames.size).toBeGreaterThan(0);

		if (finishProgress) {
			await act(async () => {
				const callbacks = [...frames.values()];
				frames.clear();
				for (const callback of callbacks) callback(performance.now() + 1000);
			});
			expect(useTauriStore.getState().tasks.update).toBeDefined();
		}

		let removed = false;
		await act(async () => {
			void useTauriStore
				.getState()
				.removeTask("update")
				.then(() => {
					removed = true;
				});
		});
		await act(async () => {
			const callbacks = [...frames.values()];
			frames.clear();
			for (const callback of callbacks) callback(performance.now() + 1000);
		});

		await expect.poll(() => removed, { timeout: 2500 }).toBe(true);
		expect(useTauriStore.getState().tasks.update).toBeUndefined();
	},
);
