import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import type { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'http';
import { router } from './index.ts';
import { betterAuth } from 'better-auth';
import { toNodeHandler } from 'better-auth/node';
import { anonymous, bearer } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { internalIpV4 } from 'internal-ip';
import { TRPCError } from '@trpc/server';
import { config } from 'dotenv';
import { resolve } from 'path';
import folders from './routes/folders.ts';
import chats from './routes/chats.ts';
import embeddings from './routes/embeddings.ts';
import messages from './routes/messages.ts';
import sessions from './routes/sessions.ts';
import providers from './routes/providers.ts';
import actions from './routes/actions.ts';
import persistence from './routes/persistence.ts';
import github from './routes/github.ts';
import generateHandler, { continueHandler } from './services/generate.ts';
import uploadHandler from './services/upload.ts';
import onTick from './worker.ts';
import { initLogs } from './utils/logs.ts';

config({ path: resolve(import.meta.dirname, '../../../.env') });
if (import.meta.main) initLogs(undefined, true);

if (import.meta.main && !globalThis.prisma) {
  globalThis.prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: `postgres://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}?schema=public&connection_limit=5&pool_timeout=0&socket_timeout=0`,
      idleTimeoutMillis: 2147483647,
      connectionTimeoutMillis: 10000,
      min: 1,
    }),
  });
}

const trpc = router({
  folders,
  chats,
  embeddings,
  messages,
  sessions,
  providers,
  actions,
  persistence,
  github,
});
export type tRPC = typeof trpc;

export const toHeaders = (reqHeaders: IncomingMessage['headers']) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(reqHeaders)) {
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else if (value) {
      headers.append(key, value);
    }
  }
  return headers;
};

const trpcContext = async ({ req, res }: { req: IncomingMessage; res: ServerResponse }) => {
  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: `Not authenticated. Headers: ${JSON.stringify(req.headers)}`,
    });
  }
  return { req, res, session };
};
export type tRPCContext = Awaited<ReturnType<typeof trpcContext>>;

const trpcHandler = createHTTPHandler({
  router: trpc,
  basePath: `${process.env.VITE_BACKEND_PATH_TRPC}/`,
  createContext: trpcContext,
  maxBodySize: 50 * 1024 * 1024,
  onError: ({ error }) => {
    console.error('tRPC Error:', error);
  },
});

export const auth = betterAuth({
  baseURL: process.argv.includes('--dev')
    ? `http://${process.argv.includes('--host') ? await internalIpV4() : 'localhost'}:${process.env.VITE_BACKEND_PORT}`
    : process.env.VITE_BACKEND_URL,
  basePath: process.env.VITE_BACKEND_PATH_AUTH,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  user: {
    deleteUser: {
      enabled: true,
    },
    additionalFields: {
      settings: {
        type: 'string' as unknown as 'json',
        required: true,
        defaultValue: {},
      },
    },
  },
  trustedOrigins: [`http://localhost:${process.env.VITE_WEB_PORT}`, process.env.VITE_WEB_URL!],
  socialProviders: {
    github: {
      clientId: process.env.AUTH_GITHUB_CLIENT!,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    },
    google: {
      clientId: process.env.AUTH_GOOGLE_CLIENT!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    },
  },
  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        console.log(
          `Transferring data from anonymous user ${anonymousUser.user.id} to new user ${newUser.user.id}`,
        );
        await globalThis.prisma.user.update({
          where: { id: newUser.user.id },
          data: { settings: { ...anonymousUser.user.settings, ...newUser.user.settings } },
        });
        await globalThis.prisma.folder.updateMany({
          where: { userId: anonymousUser.user.id },
          data: { userId: newUser.user.id },
        });
        await globalThis.prisma.chat.updateMany({
          where: { userId: anonymousUser.user.id },
          data: { userId: newUser.user.id },
        });
        await globalThis.prisma.message.updateMany({
          where: { userId: anonymousUser.user.id },
          data: { userId: newUser.user.id },
        });
        await globalThis.prisma.memory.updateMany({
          where: { userId: anonymousUser.user.id },
          data: { userId: newUser.user.id },
        });
        await globalThis.prisma.action.updateMany({
          where: { userId: anonymousUser.user.id },
          data: { userId: newUser.user.id },
        });
        console.log(
          'Transferred:',
          await globalThis.prisma.user.findFirst({ where: { id: newUser.user.id } }),
        );
      },
    }),
    bearer(),
  ],
});

const authHandler = toNodeHandler(auth);

export type User = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>['user'];

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? process.env.VITE_BACKEND_URL!);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, tRPC-Accept',
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url?.startsWith(process.env.VITE_BACKEND_PATH_TRPC!)) {
    trpcHandler(req, res);
  } else if (req.url?.startsWith(process.env.VITE_BACKEND_PATH_AUTH!)) {
    void authHandler(req, res);
  } else if (req.url?.startsWith('/@/upload')) {
    void uploadHandler(req, res);
  } else if (req.url?.startsWith('/@/generate/continue')) {
    void continueHandler(req, res);
  } else if (req.url?.startsWith('/@/generate')) {
    void generateHandler(req, res);
  } else {
    res.writeHead(200);
    res.end('OK');
  }
});

if (import.meta.main) {
  const ipv4 = await internalIpV4();
  server.listen(process.env.VITE_BACKEND_PORT, () => {
    console.log(`Backend listening at ${ipv4}:${process.env.VITE_BACKEND_PORT}`);
    const tick = async () => {
      await onTick();
      setTimeout(() => void tick(), 5 * 1000);
    };
    void tick();
    console.log('Actions worker running');
  });
}
