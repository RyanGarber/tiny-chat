import { useMutation } from "@tanstack/react-query";
import { useUploads } from "@tiny-chat/client/src/features/upload/hooks/useUploads.ts";
import { UploadType } from "@tiny-chat/core/src/features/file/types/upload.ts";
import { useState } from "react";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";

const uploadScreenshotMutationKey = ["useScreenshot", "uploadScreenshot"];

export const useScreenshot = () => {
	// Check for support
	const isScreenshotSupported = useState(() => {
		if (typeof window === "undefined") return false;
		const hasMediaDevices =
			typeof navigator !== "undefined" &&
			!!navigator.mediaDevices &&
			"getDisplayMedia" in navigator.mediaDevices;
		return hasMediaDevices && !TauriUtils.isTauri();
	});

	const { upload } = useUploads();

	const uploadScreenshot = useMutation({
		mutationKey: uploadScreenshotMutationKey,
		mutationFn: async () => {
			try {
				const stream = await navigator.mediaDevices.getDisplayMedia({
					video: true,
				});
				const video = document.createElement("video");
				video.srcObject = stream;
				await new Promise<void>((resolve) => {
					video.onloadedmetadata = () => resolve();
				});
				await video.play();

				const canvas = document.createElement("canvas");
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;

				const context = canvas.getContext("2d");
				if (!context) {
					console.error("Failed to get canvas context for screenshot:", canvas);
					return;
				}

				context.drawImage(video, 0, 0);
				stream.getTracks().forEach((track) => {
					track.stop();
				});

				canvas.toBlob((blob) => {
					if (blob) {
						const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
						const file = new File([blob], `Screenshot-${timestamp}.png`, {
							type: "image/png",
						});
						upload.mutate({ type: UploadType.ATTACHMENT, file });
					}
				}, "image/png");
			} catch (e) {
				console.error("Failed to capture screenshot:", e);
			}
		},
	});

	return { isScreenshotSupported, uploadScreenshot };
};
