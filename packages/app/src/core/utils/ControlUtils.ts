import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";

let locks = 0;

export const ControlUtils = {
	download: ({
		filename,
		content,
		mime,
	}: {
		filename: string;
		content: string | Blob;
		mime: string;
	}) => {
		// Prepend UTF-8 BOM for CSV so Excel on Windows correctly detects the encoding.
		// Without it, Excel falls back to the system ANSI codepage and corrupts non-ASCII text.
		const bom =
			typeof content === "string" && mime.startsWith("text/csv")
				? "\uFEFF"
				: "";
		const blob =
			typeof content === "string"
				? new Blob([bom + content], { type: mime })
				: content;
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	},

	/**
	 * Convert SVG string to PNG blob for export
	 */
	rasterize: (
		svgString: string,
		options?: { scale?: number },
	): Promise<Blob> => {
		const scale = options?.scale ?? 5;

		return new Promise((resolve, reject) => {
			const encoded = `data:image/svg+xml;base64,${FileUtils.getBase64FromText({ text: svgString })}`;
			console.log(encoded);

			const img = new Image();
			img.crossOrigin = "anonymous";

			img.onload = () => {
				const canvas = document.createElement("canvas");
				const w = img.width * scale;
				const h = img.height * scale;

				canvas.width = w;
				canvas.height = h;

				const ctx = canvas.getContext("2d");

				if (!ctx) {
					reject(
						new Error("Failed to create 2D canvas context for PNG export"),
					);
					return;
				}

				// Do NOT draw a background → transparency preserved
				// ctx.clearRect(0, 0, w, h);

				ctx.drawImage(img, 0, 0, w, h);

				// Export PNG (lossless, keeps transparency)
				canvas.toBlob((blob) => {
					if (!blob) {
						reject(new Error("Failed to create PNG blob"));
						return;
					}
					resolve(blob);
				}, "image/png");
			};

			img.onerror = () => reject(new Error("Failed to load SVG image"));
			img.src = encoded;
		});
	},

	lockScroll: () => {
		locks++;
		if (locks === 1) {
			document.body.style.overflow = "hidden";
		}
	},

	unlockScroll: () => {
		locks = Math.max(0, locks - 1);
		if (locks === 0) {
			document.body.style.overflow = "";
		}
	},
} as const;
