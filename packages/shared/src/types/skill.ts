import { z } from 'zod';

export const zSkill = z.object({
  name: z.string(),
  path: z.string(),
  description: z.string(),
  attributes: z.record(z.string(), z.unknown()),
});
export type zSkill = z.infer<typeof zSkill>;
