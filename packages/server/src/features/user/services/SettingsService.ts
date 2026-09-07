import { TypeUtils } from "@tiny-chat/core/src/core/utils/TypeUtils.ts";
import type { FolderLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type {
	zSettings,
	zUser,
} from "@tiny-chat/core/src/features/data/types/user.ts";

export const SettingsService = {
	getSettings: async ({
		user,
		folder,
	}: {
		user: zUser;
		folder?: FolderLike | null;
	}): Promise<zSettings> => {
		if (typeof folder === "string") folder = { id: folder };

		if (folder?.id) {
			const row = await globalThis.db.orm.public.Folder.where({
				userId: user.id,
				id: folder.id,
			})
				.select("settings")
				.first();
			if (!row) throw new Error("missing folder");
			return row.settings;
		}

		const row = await globalThis.db.orm.public.User.where({ id: user.id })
			.select("settings")
			.first();
		if (!row) throw new Error("missing user");
		return row.settings;
	},

	getSettingsRaw: async ({
		user,
		folder,
	}: {
		user: zUser;
		folder?: FolderLike | null;
	}) => {
		if (typeof folder === "string") folder = { id: folder };

		if (folder?.id) {
			const row = await globalThis.db
				.runtime()
				.query(
					globalThis.db.sql.public.folder
						.select("settingsRaw", (f, fns) =>
							fns.raw`${f.settings}`.returns("pg/jsonb@1"),
						)
						.where((f, fns) =>
							fns.and(fns.eq(f.userId, user.id), fns.eq(f.id, folder.id)),
						)
						.build(),
				)
				.firstOrThrow();
			return row.settingsRaw;
		}

		const row = await globalThis.db
			.runtime()
			.query(
				globalThis.db.sql.public.user
					.select("settingsRaw", (f, fns) =>
						fns.raw`${f.settings}`.returns("pg/jsonb@1"),
					)
					.where((f, fns) => fns.eq(f.id, user.id))
					.build(),
			)
			.firstOrThrow();
		return row.settingsRaw;
	},

	setSettings: async ({
		user,
		folder,
		update,
	}: {
		user: zUser;
		folder?: FolderLike | null;
		update: (old: zSettings) => zSettings;
	}): Promise<zSettings> => {
		if (typeof folder === "string") folder = { id: folder };
		let settings = await SettingsService.getSettings({ user, folder });
		settings = update(TypeUtils.deepClone(settings));
		if (folder?.id) {
			await globalThis.db.orm.public.Folder.where({
				userId: user.id,
				id: folder.id,
			}).update({
				settings,
			});
			return settings;
		}
		await globalThis.db.orm.public.User.where({ id: user.id }).update({
			settings,
		});
		return settings;
	},
} as const;
