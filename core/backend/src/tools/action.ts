import type { ToolCall, ToolContext } from './index.ts';
import { z } from 'zod';
import rrule from 'rrule';
import { createId } from '@paralleldrive/cuid2';
import { getNextRunAt, texts, zData } from '../types.ts';

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

const zAddAction = z.object({
  prompt: z.string().describe('The prompt to send when the action runs.'),
  schedule: z.string().describe('An RRule (RFC 5545) schedule. Do not convert - use local time.'),
});

const AddAction = {
  name: 'add_action',
  description: 'Schedule a prompt to send to a model.',
  parameters: zAddAction.toJSONSchema(),
  schema: zAddAction,
  run: async ({ message, generateInput }, params) => {
    if (!message.id) throw new Error('Cannot use tool in this context');
    const schedule = toUTC(params.schedule, generateInput.timezone);
    const action = await globalThis.prisma.action.create({
      data: {
        id: createId(),
        user: { connect: { id: message.userId } },
        folder: { connect: { id: message.folderId } },
        chat: { connect: { id: message.chatId } },
        message: { connect: { id: message.id } },
        config: message.config,
        data: [{ type: 'text', value: params.prompt }] satisfies zData,
        schedule,
        timezone: generateInput.timezone,
      },
    });
    return { success: true, actionId: action.id };
  },
} satisfies ToolCall<typeof zAddAction>;

const zUpdateAction = z.object({
  id: z.cuid2().describe('The ID of the action to update.'),
  prompt: z.string().describe('The prompt to send when the action runs.'),
  schedule: z.string().describe('An RRule (RFC 5545) schedule. Do not convert - use local time.'),
});

const UpdateAction = {
  name: 'update_action',
  description: 'Update an existing action.',
  parameters: zUpdateAction.toJSONSchema(),
  schema: zUpdateAction,
  run: async ({ message, generateInput }, params) => {
    if (!message.id) throw new Error('Cannot use tool in this context');
    const schedule = toUTC(params.schedule, generateInput.timezone);
    const action = await globalThis.prisma.action.update({
      where: {
        id: params.id,
        userId: message.userId,
      },
      data: {
        data: [{ type: 'text', value: params.prompt }] satisfies zData,
        schedule,
        timezone: generateInput.timezone,
      },
    });
    return { success: true, actionId: action.id };
  },
} satisfies ToolCall<typeof zUpdateAction>;

const zDeleteAction = z.object({
  id: z.cuid2().describe('The ID of the action to delete.'),
});

const DeleteAction = {
  name: 'delete_action',
  description: 'Delete an existing action.',
  parameters: zDeleteAction.toJSONSchema(),
  schema: zDeleteAction,
  run: async ({ message }, params) => {
    if (!message.id) throw new Error('Cannot use tool in this context');
    await globalThis.prisma.action.delete({
      where: { id: params.id, userId: message.userId },
    });
    return { success: true };
  },
} satisfies ToolCall<typeof zDeleteAction>;

const zListActions = z.object({});

const ListActions = {
  name: 'list_actions',
  description: "List the user's actions.",
  parameters: zListActions.toJSONSchema(),
  schema: zListActions,
  run: async ({ message }) => {
    if (!message.id) throw new Error('Cannot use tool in this context');
    return await Promise.all(
      (await globalThis.prisma.action.findMany({ where: { userId: message.userId } })).flatMap(
        async (a) =>
          (await getNextRunAt(a))
            ? [`[${a.id}] ${texts(zData.parse(a.data))} (${a.schedule})`]
            : [],
      ),
    );
  },
} satisfies ToolCall<typeof zListActions>;

export default function tools({ chat }: ToolContext) {
  return chat ? [AddAction, UpdateAction, DeleteAction, ListActions] : [];
}
