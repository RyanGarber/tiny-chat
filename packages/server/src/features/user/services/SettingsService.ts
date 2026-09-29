import { TypeUtils } from "@tiny-chat/core/core/utils/TypeUtils.ts";
import type { ProjectLike } from "@tiny-chat/core/features/data/types/chat.ts";
import type {
	zSettings,
	zUser,
} from "@tiny-chat/core/features/data/types/user.ts";

export const SettingsService = {
	getSettings: async ({
		user,
		project,
	}: {
		user: zUser;
		project?: ProjectLike | null;
	}): Promise<zSettings> => {
		if (typeof project === "string") project = { id: project };

		if (project?.id) {
			const row = await globalThis.db.orm.public.Project.where({
				userId: user.id,
				id: project.id,
			})
				.select("settings")
				.first();
			if (!row) throw new Error("missing project");
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
		project,
	}: {
		user: zUser;
		project?: ProjectLike | null;
	}) => {
		if (typeof project === "string") project = { id: project };

		if (project?.id) {
			const row = await globalThis.db
				.runtime()
				.query(
					globalThis.db.sql.public.project
						.select("settingsRaw", (f, fns) =>
							fns.raw`${f.settings}`.returns("pg/jsonb@1"),
						)
						.where((f, fns) =>
							fns.and(fns.eq(f.userId, user.id), fns.eq(f.id, project.id)),
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
		project,
		update,
	}: {
		user: zUser;
		project?: ProjectLike | null;
		update: (old: zSettings) => zSettings;
	}): Promise<zSettings> => {
		if (typeof project === "string") project = { id: project };
		let settings = await SettingsService.getSettings({ user, project });
		settings = update(TypeUtils.deepClone(settings));
		if (project?.id) {
			await globalThis.db.orm.public.Project.where({
				userId: user.id,
				id: project.id,
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
