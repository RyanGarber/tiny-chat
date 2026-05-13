import type { ToolCall, ToolContext } from './index.ts';
import { z } from 'zod';
import { LegiscanClient, State, zNames } from '@ryangarber/legiscan-ts';

const zListSessions = z.object({
  state: zNames(State),
});

const ListSessions: ToolCall<typeof zListSessions> = {
  name: 'list_sessions',
  description: 'List the last five legislative sessions for a state.',
  parameters: zListSessions.toJSONSchema(),
  schema: zListSessions,
  run: async ({ user }, params) => {
    const client = new LegiscanClient(user.settings.providers.legiscan.apiKey as string);
    const sessions = await client.getSessionList({ state: params.state });
    return sessions.slice(0, 5).map((session) => ({
      id: session.session_id,
      title: session.session_title,
      adjourned: session.sine_die,
    }));
  },
};

const zListBills = z.object({
  session: z.number(),
  include: z.enum(['pendingVote', 'pendingSignature', 'complete']),
});

const ListBills: ToolCall<typeof zListBills> = {
  name: 'list_bills',
  description: 'List active bills in a legislative session.',
  parameters: zListBills.toJSONSchema(),
  schema: zListBills,
  run: async ({ user }, params) => {
    const client = new LegiscanClient(user.settings.providers.legiscan.apiKey as string);
    const bills = await client.getMasterList({ session: params.session });
    return bills
      .filter((bill) => {
        if (params.include === 'pendingVote')
          return bill.status === 'Introduced' || bill.status === 'Engrossed';
        if (params.include === 'pendingSignature') return bill.status === 'Enrolled';
        if (params.include === 'complete')
          return bill.status === 'Passed' || bill.status === 'Vetoed';
      })
      .map((bill) => ({
        id: bill.bill_id,
        title: bill.title,
        description: bill.description,
        status: bill.status,
        last_action: bill.last_action,
        last_action_date: bill.last_action_date,
      }));
  },
};

const zViewBill = z.object({
  bill: z.number(),
});

const ViewBill: ToolCall<typeof zViewBill> = {
  name: 'view_bill',
  description: 'Get the status and details of a legislative bill.',
  parameters: zViewBill.toJSONSchema(),
  schema: zViewBill,
  run: async ({ user }, params) => {
    const client = new LegiscanClient(user.settings.providers.legiscan.apiKey as string);
    const bill = await client.getBill({ id: params.bill });
    return {
      title: bill.title,
      description: bill.description,
      status: bill.status,
      history: bill.history.map((item) => ({
        action: item.action,
        date: item.date,
      })),
      sponsors: bill.sponsors.map((sponsor) => ({
        name: sponsor.name,
        party: sponsor.party,
      })),
    };
  },
};

export default function tools({ user }: ToolContext) {
  if (!user.settings.providers?.legiscan?.apiKey) return [];

  return [ListSessions, ListBills, ViewBill];
}
