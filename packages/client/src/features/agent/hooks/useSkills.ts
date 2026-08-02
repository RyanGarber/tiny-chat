import { useMutation, useQuery } from "@tanstack/react-query";
import { UploadType } from "@tiny-chat/core/src/features/file/types/upload.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import { SkillUtils } from "@tiny-chat/core/src/features/skill/utils/SkillUtils.ts";
import { useContext, useMemo } from "react";
import { ClientProvider } from "../../../client.ts";
import { useCapabilities } from "../../capability/hooks/useCapabilities.ts";

export const localSkillsQueryKey = ["skills", "local"] as const;
export const nativeSkillsQueryKey = ["skills", "native"] as const;

export const useSkills = () => {
	const client = useContext(ClientProvider);

	const localSkills = useQuery({
		queryKey: localSkillsQueryKey,
		queryFn: async () => {
			const skills: zSkill[] = [];

			if (client.shell) {
				const walk = async (path: string) => {
					const files: { path: string; data: string }[] = [];

					const items = (await client.shell?.readDir({ path })) ?? [];

					for (const item of items) {
						if (item.is_dir) {
							files.push(...(await walk(item.path)));
						} else {
							const file = await client.shell?.readFile({
								path: item.path,
							});
							if (file) {
								files.push({
									...file,
									data: FileUtils.getBase64FromBytes(file),
								});
							}
						}
					}
					return files;
				};

				const paths = (
					await client.shell.readDir({
						path: "~/.agents/skills",
					})
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
			}

			console.log("[Skill Service] built local skills:", skills);
			return skills;
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const nativeSkills = useQuery({
		queryKey: nativeSkillsQueryKey,
		queryFn: async () => {
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
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const deleteNativeSkill = useMutation({
		...client.query.upload.deleteUpload.mutationOptions(),
		onSuccess: () => {
			void nativeSkills.refetch();
		},
	});

	const skills = useMemo(() => {
		return [...(localSkills.data ?? []), ...(nativeSkills.data ?? [])];
	}, [localSkills.data, nativeSkills.data]);

	return { localSkills, nativeSkills, deleteNativeSkill, skills };
};
