import type { ToolCall, ToolContext } from './index.ts';
import { z } from 'zod';
import { LegiscanClient } from '@ryangarber/legiscan-ts';

/*const zListSessions = z.object({
  state: z.string().describe('The two-letter state abbreviation, e.g. "CA" or "NY".'),
});

const ListSessions: ToolCall<typeof zListSessions> = {
  name: 'list_sessions',
  description: 'List legislative sessions for a given state.',
  parameters: zListSessions.toJSONSchema(),
  schema: zListSessions,
  run: async (_, params) => {
    const response = await fetch(
      `https://api.legiscan.com/?key=API_KEY&op=getSessionList&state=${params.state}`,
    );
    const json = (await response.json()) as {
      sessions: { session_id: number; session_name: string }[];
    };
    return json.sessions.map((s) => ({ id: s.session_id, name: s.session_name }));
  },
};

const zListBills = z.object({
  state: z.string().length(2).describe('The two-letter state abbreviation, e.g. "CA" or "NY".'),
});*/

const zViewBill = z.object({
  //session: z.int().describe('The session from list_sessions the bill belongs to.'),
  state: z.string().length(2).describe('The two-letter state abbreviation, e.g. "CA" or "NY".'),
  bill: z.string().describe('The bill number, e.g. "HB1234" or "S5678".'),
});

const ViewBill: ToolCall<typeof zViewBill> = {
  name: 'view_bill',
  description: 'View details about a legislative bill in the latest session of a given state.',
  parameters: zViewBill.toJSONSchema(),
  schema: zViewBill,
  run: async ({ user }, params) => {
    const client = new LegiscanClient(user.settings.providers.legiscan.apiKey as string);
    const bills = (await client.getMasterList({ state: params.state })) as {
      bill_id: number;
      number: string;
    }[];
    for (const entry of bills) {
      if (
        entry.bill_id.toString() === params.bill ||
        entry.number.toLowerCase() === params.bill.toLowerCase()
      ) {
        const bill = await client.getBill({ id: entry.bill_id });
        return {
          bill: bill.bill_number,
          title: bill.title,
          description: bill.description,
          history: bill.history.map(
            (h: { date: string; action: string }) => `${h.date}: ${h.action}`,
          ),
          sponsors: bill.sponsors.map(
            (s: { role: string; name: string; party: string }) =>
              `${s.role}. ${s.name} (${s.party})`,
          ),
        };
      }
    }
  },
};

export default function tools({ user }: ToolContext) {
  if (!user.settings.providers?.legiscan?.apiKey) return [];

  return [ViewBill];
}
