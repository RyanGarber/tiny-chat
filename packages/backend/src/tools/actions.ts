import { z } from 'zod';
import rrule from 'rrule';
import { createId } from '@paralleldrive/cuid2';
import { zConfig, zData } from '@tiny-chat/shared/src/types/chat.ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { getNextRunAt, texts } from '@tiny-chat/shared/src/utils.ts';

export const zAddActionInput = z.object({
  prompt: z.string().describe('The prompt to send when the action runs.'),
  schedule: z.string().describe('An RRule (RFC 5545) schedule. Do not convert - use local time.'),
});
export type zAddActionInput = z.infer<typeof zAddActionInput>;

export const zAddActionOutput = z.object({
  created_action_id: z.cuid2(),
});
export type zAddActionOutput = z.infer<typeof zAddActionOutput>;

export const AddAction: Tool<typeof zAddActionInput, typeof zAddActionOutput> = {
  name: 'add_action',
  description: 'Schedule a prompt to send to a model.',
  input: zAddActionInput.toJSONSchema(),
  output: zAddActionOutput.toJSONSchema(),
  requirements: {
    chat: true,
    notIncognito: true,
  },
  run: async ({ chat, generation }, input) => {
    const schedule = toUTC(input.schedule, generation.timezone);
    const action = await globalThis.prisma.action.create({
      data: {
        id: createId(),
        user: { connect: { id: chat!.userId } },
        folder: { connect: { id: chat!.folderId } },
        chat: { connect: { id: chat!.id } },
        message: { connect: { id: generation.context[generation.context.length - 1].id! } },
        config: generation.config,
        data: [[{ type: 'text', value: input.prompt }]] satisfies zData,
        schedule,
        timezone: generation.timezone,
      },
    });
    return [{ type: 'json', value: { created_action_id: action.id } }];
  },
};

export const zUpdateActionInput = z.object({
  id: z.cuid2().describe('The ID of the action to update.'),
  prompt: z.string().describe('The prompt to send when the action runs.'),
  schedule: z.string().describe('An RRule (RFC 5545) schedule. Do not convert - use local time.'),
});
export type zUpdateActionInput = z.infer<typeof zUpdateActionInput>;

export const zUpdateActionOutput = z.object({
  updated_action_id: z.cuid2(),
});
export type zUpdateActionOutput = z.infer<typeof zUpdateActionOutput>;

export const UpdateAction: Tool<typeof zUpdateActionInput, typeof zUpdateActionOutput> = {
  name: 'update_action',
  description: 'Update an existing action.',
  input: zUpdateActionInput.toJSONSchema(),
  output: zUpdateActionOutput.toJSONSchema(),
  requirements: {
    notIncognito: true,
  },
  run: async ({ user, generation }, input) => {
    const schedule = toUTC(input.schedule, generation.timezone);
    const action = await globalThis.prisma.$transaction([
      globalThis.prisma.action.update({
        where: {
          id: input.id,
          userId: user.id,
        },
        data: {
          data: [[{ type: 'text', value: input.prompt }]] satisfies zData,
          schedule,
          timezone: generation.timezone,
        },
      }),
      globalThis.prisma
        .$executeRaw`UPDATE action SET embedding = NULL WHERE id = ${input.id} AND "userId" = ${user.id}`,
    ]);
    return [{ type: 'json', value: { updated_action_id: action[0].id } }];
  },
};

export const zDeleteActionInput = z.object({
  id: z.cuid2().describe('The ID of the action to delete.'),
  reason: z.cuid2().describe('The reason for deleting the action.'),
});
export type zDeleteActionInput = z.infer<typeof zDeleteActionInput>;

export const zDeleteActionOutput = z.object({
  deleted_action_id: z.cuid2(),
});
export type zDeleteActionOutput = z.infer<typeof zDeleteActionOutput>;

export const DeleteAction: Tool<typeof zDeleteActionInput, typeof zDeleteActionOutput> = {
  name: 'delete_action',
  description: 'Delete an existing action.',
  input: zDeleteActionInput.toJSONSchema(),
  output: zDeleteActionOutput.toJSONSchema(),
  requirements: {
    notIncognito: true,
  },
  run: async ({ user }, input) => {
    await globalThis.prisma.action.delete({
      where: { id: input.id, userId: user.id },
    });
    return [{ type: 'json', value: { deleted_action_id: input.id } }];
  },
};

export const zListActionsInput = z.object({
  active_only: z
    .boolean()
    .default(true)
    .describe('Only list actions that are scheduled to run again.'),
});
export type zListActionsInput = z.infer<typeof zListActionsInput>;

export const zListActionsOutput = z.array(
  z.object({
    id: z.cuid2(),
    chatId: z.cuid2(),
    config: zConfig,
    schedule: z.string(),
    prompt: z.string(),
  }),
);
export type zListActionsOutput = z.infer<typeof zListActionsOutput>;

export const ListActions: Tool<typeof zListActionsInput, typeof zListActionsOutput> = {
  name: 'list_actions',
  description: "List the user's actions across all chats.",
  input: zListActionsInput.toJSONSchema(),
  output: zListActionsOutput.toJSONSchema(),
  requirements: {
    notIncognito: true,
  },
  run: async ({ user }, input) => {
    return [
      {
        type: 'json',
        value: (
          await globalThis.prisma.action.findMany({
            where: { userId: user.id },
          })
        )
          .filter((action) => !input.active_only || getNextRunAt(action))
          .map((action) => ({
            id: action.id,
            chatId: action.chatId,
            config: zConfig.parse(action.config),
            schedule: action.schedule,
            prompt: texts(zData.parse(action.data)),
          })),
      },
    ];
  },
};

export const actions: ToolGroup = {
  name: 'actions',
  tools: [AddAction, UpdateAction, DeleteAction, ListActions],
  instructions: {
    heading: 'Actions',
    body: `Actions allow for prompts to be sent in chat on a recurring basis, useful for updates on news and events.
If regular updates could be useful for the topic, ask the user proactively if they would like to be kept up-to-date and create an action if so.`,
  },
};

function getOffsetMinutes(timezone: string): number {
  const now = new Date();
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  return (local.getTime() - utc.getTime()) / (60 * 1000);
}

function toUTC(schedule: string, timezone: string): string {
  const rule = rrule.RRule.fromString(schedule);

  const options = { ...rule.origOptions };
  const offset = getOffsetMinutes(timezone);

  if (options.byhour !== undefined) {
    const hours = Array.isArray(options.byhour) ? options.byhour : [options.byhour];
    const minute = Array.isArray(options.byminute) ? options.byminute[0] : (options.byminute ?? 0);

    options.byhour = hours.map((h) => {
      const totalUTC = (h ? h * 60 : 0) + minute - offset;
      return ((Math.floor(totalUTC / 60) % 24) + 24) % 24;
    });

    if (options.byminute !== undefined) {
      const totalUTC = (hours[0] ? hours[0] * 60 : 0) + minute - offset;
      options.byminute = [((totalUTC % 60) + 60) % 60];
    }
  }

  options.dtstart = options.dtstart
    ? new Date(options.dtstart.getTime() - offset * 60000)
    : new Date();

  console.log(
    `Parsing schedule ${schedule} (currently ${new Date().toString()})`,
    `(dtstart ${rule.origOptions.dtstart?.toString()} -> [+/- ${offset} minutes] -> ${options.dtstart.toString()})`,
  );
  return new rrule.RRule(options).toString();
}
