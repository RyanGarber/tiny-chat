import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { z } from 'zod';

const zUseSkillInput = z.object({
  skill: z.string(),
  resource: z.string().optional(),
});
type zUseSkillInput = z.infer<typeof zUseSkillInput>;

const zUseSkillOutput = z.object({
  content: z.string(),
  resources: z.array(z.string()).optional(),
});
type zUseSkillOutput = z.infer<typeof zUseSkillOutput>;

export const UseSkill: Tool<typeof zUseSkillInput, typeof zUseSkillOutput> = {
  name: 'use_skill',
  description: 'Activate a skill and optionally read one of its resources',
  input: zUseSkillInput.toJSONSchema(),
  output: zUseSkillOutput.toJSONSchema(),
  // TODO - requirements
  // eslint-disable-next-line @typescript-eslint/require-await
  run: async (context, input) => {
    const skill = context.skills.find((s) => s.name === input.skill);
    if (!skill) throw new Error(`Skill not found: ${input.skill}`);

    if (input.resource) {
      const resource = skill.resources.find((r) => r.path === input.resource);
      if (!resource) throw new Error(`Resource not found: ${input.resource}`);
      return {
        content: resource.content,
      };
    } else {
      return {
        content: skill.content,
        resources: skill.resources.map((r) => r.path),
      };
    }
  },
};

export const skills: ToolGroup = {
  name: 'skill',
  tools: [UseSkill],
  instructions: {
    heading: 'Skills',
    body: "You have various skills as an agent that are useful for completing tasks. Call `use_skill` to activate a skill or read a skill's resources.",
  },
};
