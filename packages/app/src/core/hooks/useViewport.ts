import { useEffect, useRef, useState } from "react";

export function useViewport() {
	const [height, setHeight] = useState(
		window.visualViewport?.height ?? window.innerHeight,
	);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		let frameId: number;

		const onUpdate = () => {
			cancelAnimationFrame(frameId);
			frameId = requestAnimationFrame(() => {
				setHeight(vv.height);
				if (containerRef.current)
					containerRef.current.style.transform = `translateY(${vv.offsetTop}px)`;
			});
		};

		// Immediately set initial values
		onUpdate();

		vv.addEventListener("resize", onUpdate);
		vv.addEventListener("scroll", onUpdate);
		return () => {
			cancelAnimationFrame(frameId);
			vv.removeEventListener("resize", onUpdate);
			vv.removeEventListener("scroll", onUpdate);
		};
	}, []);

	return { height, containerRef };
}
