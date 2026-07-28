import {
	zSettings,
	type zUser,
} from "@tiny-chat/shared/src/features/data/types/user.ts";

export const SettingsService = {
	getSettings: async ({
		user,
		fallback = {},
	}: {
		user: zUser;
		fallback?: zSettings;
	}) => {
		const { settings } = await globalThis.prisma.user.findUniqueOrThrow({
			where: { id: user.id },
			select: { settings: true },
		});
		return zSettings.parse(settings ?? fallback);
	},

	setSettings: async ({
		user,
		update,
	}: {
		user: zUser;
		update: (old: zSettings) => zSettings;
	}) => {
		let settings = zSettings.parse(user.settings ?? {});
		settings = update(settings);
		await globalThis.prisma.user.update({
			where: { id: user.id },
			data: { settings },
		});
		return zSettings.parse(settings);
	},
} as const;
