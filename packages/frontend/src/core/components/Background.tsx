import { Box } from "@mantine/core";
import { useEffect, useMemo, useRef } from "react";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useChatStore } from "#frontend/features/chat/stores/useChatStore.ts";
import { useThemes } from "#frontend/features/settings/hooks/useThemes.ts";

export default function Background() {
	const createIncognito = useChatStore((s) => s.createIncognito);
	const { chat } = useChat();
	const { blackout } = useThemes();

	const black = useMemo(
		() => blackout.data || (chat.data?.incognito ?? createIncognito),
		[blackout, chat.data?.incognito, createIncognito],
	);

	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const colors = black ? ["#000000", "#000000"] : ["#3b79e7", "#21a7ff"];

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
	}, [black]); // re-initializes if colors change

	return (
		<Box
			pos="absolute"
			inset={0}
			style={{
				zIndex: -1,
				maskImage: `linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%)`,
				opacity: chat.data ? 0.125 : 0.5,
				transition: "opacity 0.3s ease",
			}}
		>
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
		</Box>
	);
}
