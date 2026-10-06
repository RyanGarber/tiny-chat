import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { FileOperationService } from "#core/features/file/services/FileOperationService.ts";
import { FileSearchService } from "#core/features/file/services/FileSearchService.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";
import type { zSkill } from "#core/features/skill/types/skill.ts";
import { SkillUtils } from "#core/features/skill/utils/SkillUtils.ts";

/** Where local skills live, a directory each. */
const LOCAL_SKILLS_PATH = "~/.agents/skills";

/** Bytes of a SKILL.md read; only its frontmatter is parsed. */
const MAX_SKILL_MD_BYTES = 256_000;

export const localSkillsQueryKey = ["skills", "local"] as const;
export const nativeSkillsQueryKey = ["skills", "native"] as const;

export const useSkills = () => {
	const client = useContext(ClientContext);

	const localSkills = useQuery({
		queryKey: localSkillsQueryKey,
		queryFn: async () => {
			const shell = client.shell;
			if (!shell) return [];

			// One walk and one read, rather than a `readDir` per directory and a
			// `readFile` per file: only each skill's SKILL.md is parsed.
			let walked: Awaited<ReturnType<typeof FileSearchService.walk>>;
			try {
				walked = await FileSearchService.walk({
					shell,
					path: LOCAL_SKILLS_PATH,
					scope: "listing",
					includeDirectories: true,
					gitignore: false,
				});
			} catch {
				// No skills directory, so no local skills.
				return [];
			}

			// Each directory under the root is a skill; its SKILL.md is the
			// shallowest one in it.
			const found = new Map<
				string,
				{ path: string; skillMd?: { path: string; depth: number } }
			>();
			for (const entry of walked.entries) {
				const [name, ...rest] = PathUtils.split(
					PathUtils.relative({ base: walked.root, path: entry.path }),
				);
				if (!name) continue;
				if (!rest.length) {
					if (entry.is_dir) found.set(name, { path: entry.path });
					continue;
				}
				const skill = found.get(name);
				if (
					!skill ||
					entry.is_dir ||
					rest.at(-1)?.toLowerCase() !== "skill.md" ||
					(skill.skillMd && skill.skillMd.depth <= rest.length)
				)
					continue;
				skill.skillMd = { path: entry.path, depth: rest.length };
			}

			const local = [...found.values()];
			const reads = local.flatMap(({ skillMd }) =>
				skillMd ? [skillMd.path] : [],
			);
			const data = await FileOperationService.readFiles({
				shell,
				paths: reads,
				maxBytes: MAX_SKILL_MD_BYTES,
			});
			const read = new Map(reads.map((path, index) => [path, data[index]]));

			const skills: zSkill[] = [];
			for (const { path, skillMd } of local) {
				let skill: zSkill | null = null;
				const file = skillMd && read.get(skillMd.path);
				if (skillMd && file) {
					try {
						skill = SkillUtils.buildSkill({
							files: [{ path: skillMd.path, data: file.data }],
						});
					} catch (error) {
						console.warn("failed to build local skill:", error);
					}
				}
				skills.push(
					skill ?? {
						path,
						name: "",
						description: "Error: unrecognized format",
						attributes: {},
					},
				);
			}

			console.log("[useSkills] built local skills:", skills);
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

			const remoteSkills = await client.api.upload.getSkills.query();
			for (const { id, files } of remoteSkills) {
				let skill: zSkill | null = null;
				try {
					skill = SkillUtils.buildSkill({
						files: files.map((file) => ({ path: file.uri, data: file.data })),
					});
				} catch (error) {
					console.warn("failed to build native skill:", error);
				}
				skills.push(
					skill ?? {
						path: PathUtils.toMount({ mount: "skills", id }),
						name: "",
						description: "Error: unrecognized format",
						attributes: {},
					},
				);
			}

			console.log("[useSkills] built native skills:", skills);
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
