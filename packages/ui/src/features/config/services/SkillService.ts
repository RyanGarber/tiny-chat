import { UploadType } from "#core/features/file/types/upload.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";
import type { zSkill } from "#core/features/skill/types/skill.ts";
import { SkillUtils } from "#core/features/skill/utils/SkillUtils.ts";
import { client } from "#ui/client.ts";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";

export const SkillService = {
	findLocal: async () => {
		const skills: zSkill[] = [];

		if (await TauriUtils.isTauriDesktop()) {
			try {
				const walk = async (path: string) => {
					const files: { path: string; data: string }[] = [];

					const items = await TauriUtils.invoke<
						{ path: string; is_dir: boolean }[]
					>("read_dir", { path });

					for (const item of items) {
						if (item.is_dir) {
							files.push(...(await walk(item.path)));
						} else {
							files.push(
								await TauriUtils.invoke<{ path: string; data: string }>(
									"read_file",
									{
										path: item.path,
									},
								),
							);
						}
					}
					return files;
				};

				const paths = (
					await TauriUtils.invoke<{ path: string; is_dir: boolean }[]>(
						"read_dir",
						{
							path: "~/.agents/skills",
						},
					)
				).filter((e) => e.is_dir);

				for (const { path } of paths) {
					try {
						const skill = SkillUtils.buildSkill({
							files: await walk(path),
						});
						skills.push(
							skill ?? {
								path: PathUtils.toMount({ path }),
								name: "",
								description: "Error: unrecognized format",
								attributes: {},
							},
						);
					} catch (error) {
						console.warn("failed to build local skill:", error);
					}
				}
			} catch (error) {
				console.warn("failed to discover local skills:", error);
			}
		}

		console.log("[Skill Service] built local skills:", skills);
		return skills;
	},

	findRemote: async () => {
		const skills: zSkill[] = [];

		const remoteSkills = await client.api.upload.getUploads.query({
			where: { type: UploadType.SKILL },
			files: { where: { path: { has: "SKILL.md" } } },
		});
		for (const { id, files } of remoteSkills.uploads) {
			let skill: zSkill | null = null;
			try {
				skill = SkillUtils.buildSkill({
					files: files.map((file) => ({
						path: PathUtils.toMount(file),
						data: file.data,
					})),
				});
			} catch (error) {
				console.warn("failed to build native skill:", error);
			}
			skills.push(
				skill ?? {
					path: PathUtils.toMount({ uploadId: id }),
					name: "",
					description: "Error: unrecognized format",
					attributes: {},
				},
			);
		}

		console.log("[SkillService] built native skills:", skills);
		return skills;
	},
};
