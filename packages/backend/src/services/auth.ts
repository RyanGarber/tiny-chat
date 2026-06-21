import { internalIpV4 } from 'internal-ip';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { anonymous, bearer } from 'better-auth/plugins';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage } from 'http';
import { prisma } from '../db.ts';
import { getRandomName } from '@tiny-chat/shared/src/utils/user.ts';

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
      isEphemeral: {
        type: 'boolean',
        required: true,
        defaultValue: false,
      },
    },
  },
  trustedOrigins: [
    `http://${process.argv.includes('--host') ? await internalIpV4() : 'localhost'}:${process.env.VITE_WEB_PORT}`,
    process.env.VITE_WEB_URL!,
  ],
  socialProviders: {
    github: {
      clientId: process.env.AUTH_GITHUB_CLIENT!,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    },
    google: {
      clientId: process.env.AUTH_GOOGLE_CLIENT!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    },
    huggingface: {
      clientId: process.env.AUTH_HUGGINGFACE_CLIENT!,
      clientSecret: process.env.AUTH_HUGGINGFACE_SECRET,
    },
  },
  plugins: [
    anonymous({
      generateName: () => getRandomName(),
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        console.log(`Transferring all records from ${anonymousUser.user.id} to ${newUser.user.id}`);
        // cache is not in better auth, so it needs to be transferred manually
        const caches = await globalThis.prisma.user.findMany({
          where: { id: { in: [anonymousUser.user.id, newUser.user.id] } },
          select: { id: true, cache: true },
        });
        const cache = caches.reduce(
          (acc, user) => {
            acc[user.id] = user.cache;
            return acc;
          },
          {} as Record<string, any>,
        );
        const updates = await globalThis.prisma.$transaction([
          globalThis.prisma.user.update({
            where: { id: newUser.user.id },
            data: {
              settings: { ...anonymousUser.user.settings, ...newUser.user.settings },
              cache: { ...cache[anonymousUser.user.id], ...cache[newUser.user.id] },
            },
          }),
          globalThis.prisma.folder.updateMany({
            where: { userId: anonymousUser.user.id },
            data: { userId: newUser.user.id },
          }),
          globalThis.prisma.chat.updateMany({
            where: { userId: anonymousUser.user.id },
            data: { userId: newUser.user.id },
          }),
          globalThis.prisma.message.updateMany({
            where: { userId: anonymousUser.user.id },
            data: { userId: newUser.user.id },
          }),
          globalThis.prisma.action.updateMany({
            where: { userId: anonymousUser.user.id },
            data: { userId: newUser.user.id },
          }),
          globalThis.prisma.memory.updateMany({
            where: { userId: anonymousUser.user.id },
            data: { userId: newUser.user.id },
          }),
          globalThis.prisma.upload.updateMany({
            where: { userId: anonymousUser.user.id },
            data: { userId: newUser.user.id },
          }),
          globalThis.prisma.file.updateMany({
            where: { userId: anonymousUser.user.id },
            data: { userId: newUser.user.id },
          }),
        ]);
        console.log(`Done! ${updates.length} records transferred`);
      },
    }),
    bearer(),
    {
      id: 'token-storage',
      onResponse: async (ctx) => {
        const token = ctx.headers.get('set-auth-token');
        const location = ctx.headers.get('location');
        if (token && location) {
          const url = new URL(location);
          url.hash = url.hash ? `${url.hash}&token=${token}` : `#token=${token}`;
          ctx.headers.set('location', url.toString());
          console.log('[Auth] Redirecting:', url.toString());
        }
        await new Promise<void>((r) => r());
      },
    },
  ],
});

export const authHandler = toNodeHandler(auth);

export const authHeaders = (reqHeaders: IncomingMessage['headers']) => {
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
