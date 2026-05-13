import { z } from 'zod';
import { LegiscanClient, State } from '@ryangarber/legiscan-ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';

const zListSessionsInput = z.object({
  state: z.enum(Object.keys(State)),
});

const zListSessionsOutput = z.array(
  z.object({
    id: z.number(),
    title: z.string(),
    adjourned: z.boolean(),
  }),
);

const ListSessions: Tool<typeof zListSessionsInput, typeof zListSessionsOutput> = {
  name: 'list_sessions',
  description: 'List the last five legislative sessions for a state.',
  input: zListSessionsInput.toJSONSchema(),
  output: zListSessionsOutput.toJSONSchema(),
  requirements: {
    provider: ['legiscan'],
  },
  run: async ({ user }, input) => {
    const client = new LegiscanClient(user.settings.providers!.legiscan.apiKey as string);
    const sessions = await client.getSessionList({ state: input.state });
    return sessions.slice(0, 5).map((session) => ({
      id: session.session_id,
      title: session.session_title,
      adjourned: session.sine_die,
    }));
  },
};

const zListBillsInput = z.object({
  session: z.number(),
  include: z.enum(['pendingVote', 'pendingSignature', 'complete']),
});

const zListBillsOutput = z.array(
  z.object({
    id: z.number(),
    title: z.string(),
    description: z.string(),
    status: z.string(),
    last_action: z.string().nullable(),
    last_action_date: z.string().nullable(),
  }),
);

const ListBills: Tool<typeof zListBillsInput, typeof zListBillsOutput> = {
  name: 'list_bills',
  description: 'List active bills in a legislative session.',
  input: zListBillsInput.toJSONSchema(),
  output: zListBillsOutput.toJSONSchema(),
  requirements: {
    provider: ['legiscan'],
  },
  run: async ({ user }, input) => {
    const client = new LegiscanClient(user.settings.providers!.legiscan.apiKey as string);
    const bills = await client.getMasterList({ session: input.session });
    return bills
      .filter((bill) => {
        if (input.include === 'pendingVote')
          return bill.status === 'Introduced' || bill.status === 'Engrossed';
        if (input.include === 'pendingSignature') return bill.status === 'Enrolled';
        if (input.include === 'complete')
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

const zViewBillInput = z.object({
  bill: z.number(),
});

const zViewBillOutput = z.object({
  title: z.string(),
  description: z.string(),
  status: z.string(),
  history: z.array(
    z.object({
      action: z.string(),
      date: z.string(),
    }),
  ),
  sponsors: z.array(
    z.object({
      name: z.string(),
      party: z.string(),
    }),
  ),
});

const ViewBill: Tool<typeof zViewBillInput, typeof zViewBillOutput> = {
  name: 'view_bill',
  description: 'Get the status and details of a legislative bill.',
  input: zViewBillInput.toJSONSchema(),
  output: zViewBillOutput.toJSONSchema(),
  requirements: {
    provider: ['legiscan'],
  },
  run: async ({ user }, input) => {
    const client = new LegiscanClient(user.settings.providers!.legiscan.apiKey as string);
    const bill = await client.getBill({ id: input.bill });
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

export const legiscan: ToolGroup = {
  name: 'legiscan',
  tools: [ListSessions, ListBills, ViewBill],
  instructions: {
    heading: 'Legiscan',
    body: `You have access to real-time data from all US state legislatures.
When asked about the status of bill(s), use the list_sessions tool to find the relevant legislative session, and list_bills to find the relevant bill(s).
For more detailed info on bills, such as party affiliation and precise status updates, use the view_bill tool.`,
  },
};
