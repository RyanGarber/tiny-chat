import type { ToolCall, ToolContext } from './index.ts';
import { z } from 'zod';
import rrule from 'rrule';
import { createId } from '@paralleldrive/cuid2';
import { texts, zData } from '../types.ts';

function getOffsetMinutes(timezone: string): number {
  const now = new Date();
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  return (local.getTime() - utc.getTime()) / 60000;
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

  if (options.dtstart) {
    // Model provided a local-time DTSTART; shift to UTC.
    options.dtstart = new Date(options.dtstart.getTime() - offset * 60000);
  } else if (options.count !== undefined && options.count !== null) {
    // Finite (COUNT-limited) action: embed a UTC DTSTART so the backend
    // always uses the embedded value and never re-creates a fresh dtstart on
    // each tick (which would make COUNT=1 repeat indefinitely).
    // Date.now() is already UTC — no offset adjustment needed here.
    options.dtstart = new Date();
  }

  return new rrule.RRule(options).toString();
}

const zAddAction = z.object({
  prompt: z.string().describe('The prompt to send when the action runs.'),
  schedule: z
    .string()
    .describe("The action's RRule schedule. Write as the user says; do not include timezone."),
});

const AddAction = {
  name: 'add_action',
  description:
    'A prompt to send in this chat on a recurring basis. Use when the user wants regular updates.',
  parameters: zAddAction.toJSONSchema(),
  schema: zAddAction,
  run: async ({ message, generateInput }, params) => {
    if (!message.id) return;
    const schedule = toUTC(params.schedule, generateInput.timezone);
    await globalThis.prisma.action.create({
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
    return { success: true };
  },
} satisfies ToolCall<typeof zAddAction>;

const zUpdateAction = z.object({
  id: z.cuid2().describe('The exact ID of the action to update.'),
  prompt: z.string().describe('The new prompt for the action to send.'),
  schedule: z
    .string()
    .describe("The action's RRule schedule. Write as the user says; do not include timezone."),
  reason: z.string().describe('The reason for the update.'),
});

const UpdateAction = {
  name: 'update_action',
  description:
    'Update an existing action. Use this when the user requests an action to be modified.',
  parameters: zUpdateAction.toJSONSchema(),
  schema: zUpdateAction,
  run: async ({ message, generateInput }, params) => {
    if (!message.id) return;
    const schedule = toUTC(params.schedule, generateInput.timezone);
    await globalThis.prisma.action.update({
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
    return { success: true };
  },
} satisfies ToolCall<typeof zUpdateAction>;

const zDeleteAction = z.object({
  id: z.cuid2().describe('The exact ID of the action to delete.'),
  reason: z.string().describe('The reason for the deletion.'),
});

const DeleteAction = {
  name: 'delete_action',
  description: 'Delete an existing action. Use this when the user requests deletion.',
  parameters: zDeleteAction.toJSONSchema(),
  schema: zDeleteAction,
  run: async ({ message }, params) => {
    if (!message.id) return;
    await globalThis.prisma.action.delete({
      where: { id: params.id, userId: message.userId },
    });
    return { success: true };
  },
} satisfies ToolCall<typeof zDeleteAction>;

const zListActions = z.object({});

const ListActions = {
  name: 'list_actions',
  description: 'List all actions the user has across all chats.',
  parameters: zListActions.toJSONSchema(),
  schema: zListActions,
  run: async ({ message }) => {
    if (!message.id) return;
    return (
      await globalThis.prisma.action.findMany({
        where: { userId: message.userId },
      })
    ).map((a) => `[${a.id}] ${texts(zData.parse(a.data))} (${a.schedule})`);
  },
} satisfies ToolCall<typeof zListActions>;

export default function tools({ chat }: ToolContext) {
  return chat ? [AddAction, UpdateAction, DeleteAction, ListActions] : [];
}
