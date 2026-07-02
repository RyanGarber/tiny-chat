import waitOn from 'wait-on';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createTRPCClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { tRPCRouter } from './routes/index.ts';
import { zUser } from '@tiny-chat/shared/src/types/user.ts';
import { TestProvider } from '@tiny-chat/shared/src/providers/chat/test.ts';
import { zConfig } from '@tiny-chat/shared/src/types/chat.ts';
import type { TestProject } from 'vitest/node';
import { inject } from 'vitest';
import { createAuthClient } from 'better-auth/react';
import { anonymousClient, inferAdditionalFields } from 'better-auth/client/plugins';
import type { auth as serverAuth } from './services/auth.ts';

config({ path: resolve(import.meta.dirname, '../../../../.env'), quiet: true });

declare module 'vitest' {
  export interface ProvidedContext {
    backend_backendUrl: string;
    backend_token: string;
    backend_user: zUser;
    backend_config: zConfig;
  }
}

export async function setup(project: TestProject) {
  console.log(`[tests] waiting for backend`);
  const backendUrl = `http://localhost:${process.env.VITE_BACKEND_PORT}`;
  await waitOn({ resources: [backendUrl], timeout: 30000 });

  console.log(`[tests] creating test user`);
  const auth = testAuth(backendUrl, null);
  const session = await auth.signIn.anonymous();
  if (session.error) throw new Error(`Failed to create session: ${session.error.message}`);
  const update = await auth.updateUser({
    isEphemeral: true,
    fetchOptions: { headers: { Authorization: `Bearer ${session.data.token}` } },
  });
  if (update.error) throw new Error(`Failed to update session: ${update.error.message}`);

  const user = zUser.parse({ ...session.data.user, isEphemeral: true });

  console.log(`[tests] setting up test user with token:`, session.data.token);
  const models = await TestProvider.getModels(user);
  const model = models.find((m) => m.features.includes('generate'));
  if (!model) throw new Error('Failed to get test model');
  const config = zConfig.parse({
    provider: TestProvider.name,
    model: model.name,
    args: model.args.map((arg) => ({
      name: arg.name,
      value: arg.default,
    })),
  });

  console.log('[tests] test user ready', user);
  project.provide('backend_backendUrl', backendUrl);
  project.provide('backend_token', session.data.token);
  project.provide('backend_user', user);
  project.provide('backend_config', config);

  return async () => {
    console.log('[tests] cleaning up test user');
    const deletion = await auth.deleteAnonymousUser({
      fetchOptions: { headers: { Authorization: `Bearer ${session.data.token}` } },
    });
    if (deletion.error) throw new Error(`Failed to delete session: ${deletion.error.message}`);
  };
}

export function testAuth(
  backendUrl: string = inject('backend_backendUrl'),
  token: string | null = inject('backend_token'),
) {
  return createAuthClient({
    baseURL: backendUrl,
    basePath: process.env.VITE_BACKEND_PATH_AUTH,
    fetchOptions: {
      auth: {
        type: 'Bearer',
        token: () => token ?? undefined,
      },
    },
    plugins: [anonymousClient(), inferAdditionalFields<typeof serverAuth>()],
  });
}

export function testTRPC(
  backendUrl = inject('backend_backendUrl'),
  token = inject('backend_token'),
) {
  return createTRPCClient<tRPCRouter>({
    links: [
      httpLink({
        url: `${backendUrl}${process.env.VITE_BACKEND_PATH_TRPC}/`,
        transformer: superjson,
        headers: () => ({ Authorization: `Bearer ${token}` }),
        methodOverride: 'POST',
      }),
    ],
  });
}
