import { fm } from "../../../index.ts";
import { FileUtils } from "../../file/utils/FileUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";

export const SkillUtils = {
	/**
	 * Finds a SKILL.md in a list of files and parses it into a {@link zSkill}.
	 */
	buildSkill: ({
		files,
	}: {
		files: {
			path: string;
			data: Uint8Array | string;
		}[];
	}) => {
		let skillMd: (typeof files)[number] | undefined;

		const maxDepth = Math.max(
			...files.map((file) => PathUtils.split(file).length),
		);
		for (let i = 0; i < maxDepth; i++) {
			skillMd = files.find(
				(file) => PathUtils.split(file).at(i)?.toLowerCase() === "skill.md",
			);
			if (skillMd) break;
		}
		if (!skillMd) {
			console.log("[SkillUtils] no skill.md found:", files);
			return null;
		}

		const {
			attributes: { name, description, ...attributes },
		} = fm<{ name: string; description: string }>(
			FileUtils.getTextFromBytes(skillMd) ?? "",
		);
		if (!name) {
			console.log("[SkillUtils] invalid skill.md:", files);
			return null;
		}

		return {
			name: name,
			path: skillMd.path,
			description: description,
			attributes: attributes,
		};
	},
} as const;
