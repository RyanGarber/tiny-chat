import { useEffect, useState } from "react";

export function useFileDrag(active: boolean) {
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		const targets = new Set<EventTarget>();
		let internal = false;
		const reset = () => {
			targets.clear();
			internal = false;
			setDragging(false);
		};
		const start = () => {
			reset();
			internal = true;
		};
		const enter = (event: DragEvent) => {
			if (!active || internal || !event.dataTransfer?.types.includes("Files"))
				return;
			if (event.target) targets.add(event.target);
			setDragging(true);
		};
		const leave = (event: DragEvent) => {
			if (event.target) targets.delete(event.target);
			if (targets.size === 0) setDragging(false);
		};
		// Capture also sees editor events that stop propagation. Internal HTML
		// drags must never activate the window-wide file upload surface.
		document.addEventListener("dragstart", start, true);
		document.addEventListener("dragenter", enter, true);
		document.addEventListener("dragleave", leave, true);
		document.addEventListener("drop", reset, true);
		document.addEventListener("dragend", reset, true);
		window.addEventListener("blur", reset);
		return () => {
			document.removeEventListener("dragstart", start, true);
			document.removeEventListener("dragenter", enter, true);
			document.removeEventListener("dragleave", leave, true);
			document.removeEventListener("drop", reset, true);
			document.removeEventListener("dragend", reset, true);
			window.removeEventListener("blur", reset);
		};
	}, [active]);

	return active && dragging;
}
