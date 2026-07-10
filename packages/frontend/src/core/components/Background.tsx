import { useEffect, useRef } from "react";

export default function Background({ incognito }: { incognito: boolean }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const colors = incognito ? ["#000000", "#000000"] : ["#3b79e7", "#21a7ff"];

		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animFrameId: number | undefined;
		let a = 0;

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		resize();
		window.addEventListener("resize", resize);

		const draw = () => {
			a += 0.01;
			// Use your colors instead of rotating HSL
			const gradient = ctx.createLinearGradient(
				0,
				0,
				canvas.width,
				canvas.height,
			);
			colors.forEach((color, i) => {
				gradient.addColorStop(i / (colors.length - 1), color);
			});
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			for (let n = 0; n < 7; n++) {
				ctx.beginPath();
				ctx.moveTo(0, 0.15 * canvas.height * n + 30 * Math.sin(a + n));
				for (let x = 0; x < canvas.width; x += 10) {
					ctx.lineTo(
						x,
						0.15 * canvas.height * n + 30 * Math.sin(a + n + 0.01 * x),
					);
				}
				ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 - 0.01 * n})`;
				ctx.lineWidth = 2;
				ctx.stroke();
			}

			animFrameId = requestAnimationFrame(draw);
		};

		animFrameId = requestAnimationFrame(draw);
		return () => {
			if (animFrameId !== undefined) cancelAnimationFrame(animFrameId);
			window.removeEventListener("resize", resize);
		};
	}, [incognito]); // re-initializes if colors change

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				zIndex: -1,
			}}
		/>
	);
}
