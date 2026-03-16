/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type tRPC } from '@tiny-chat/core-backend/src/server';
import { createTRPCClient, httpLink } from '@trpc/client';
import { createAuthClient } from 'better-auth/react';
import { anonymousClient, inferAdditionalFields } from 'better-auth/client/plugins';
import superjson from 'superjson';
import { auth as serverAuth } from '@tiny-chat/core-backend/src/server.ts';

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}
declare const __TAURI_DEV_HOST__: string | undefined;

export const webUrl = import.meta.env.DEV
  ? `http://${__TAURI_DEV_HOST__ ?? 'localhost'}:${import.meta.env.VITE_WEB_PORT}`
  : import.meta.env.VITE_WEB_URL;

export const trpc = createTRPCClient<tRPC>({
  links: [
    httpLink({
      url: import.meta.env.DEV
        ? `http://${__TAURI_DEV_HOST__ ?? 'localhost'}:${import.meta.env.VITE_BACKEND_PORT}${import.meta.env.VITE_BACKEND_PATH_TRPC}`
        : `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_BACKEND_PATH_TRPC}`,
      transformer: superjson,
      headers: () => {
        const token = localStorage.getItem('token');
        return { Authorization: token ? `Bearer ${token}` : undefined };
      },
    }),
  ],
});

export const auth = createAuthClient({
  baseURL: import.meta.env.DEV
    ? `http://${__TAURI_DEV_HOST__ ?? 'localhost'}:${import.meta.env.VITE_BACKEND_PORT}`
    : import.meta.env.VITE_BACKEND_URL,
  basePath: import.meta.env.VITE_BACKEND_PATH_AUTH,
  fetchOptions: {
    auth: {
      type: 'Bearer',
      token: () => localStorage.getItem('token') ?? undefined,
    },
  },
  plugins: [anonymousClient(), inferAdditionalFields<typeof serverAuth>()],
});
