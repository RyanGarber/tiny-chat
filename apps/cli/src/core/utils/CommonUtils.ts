export const CommonUtils = {
	webUrl: process.env.DEV
		? `http://localhost:${process.env.VITE_WEB_PORT}`
		: process.env.VITE_WEB_URL,
} as const;
