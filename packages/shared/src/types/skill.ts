import { z } from 'zod';

export const zSkill = z.object({
  name: z.string(),
  path: z.string(),
  description: z.string(),
  attributes: z.record(z.string(), z.unknown()),
  content: z.string(),
  resources: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    }),
  ),
});
export type zSkill = z.infer<typeof zSkill>;
