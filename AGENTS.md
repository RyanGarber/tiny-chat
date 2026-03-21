# AGENTS.md (tiny-chat)

## Big picture
- PNPM workspace monorepo (`pnpm-workspace.yaml`) with:
  - `core/backend`: Node HTTP server exposing **tRPC** + **better-auth** + small `/@/generate` and `/@/upload` endpoints.
  - `core/frontend`: Vite + React (Mantine) UI; ships inside Tauri or as web build.
  - `apps/tauri`: Tauri v2 shell for desktop/iOS/Android.
  - `apps/web`: Fastify static host for `core/frontend` build output.

## How components talk
- Frontend calls backend over HTTP:
  - tRPC base path: `VITE_BACKEND_PATH_TRPC` (server uses `createHTTPHandler(..., basePath: ${VITE_BACKEND_PATH_TRPC}/)` in `core/backend/src/server.ts`).
  - Auth base path: `VITE_BACKEND_PATH_AUTH` (better-auth handler in same file).
- Auth is **Bearer token** driven:
  - UI stores `token` in `localStorage` (see `core/frontend/src/App.tsx`).
  - tRPC client sends `Authorization: Bearer <token>` (see `core/frontend/src/utils/api.ts`).
- In dev, URLs are computed from ports/hosts; Tauri dev host uses `TAURI_DEV_HOST` / `__TAURI_DEV_HOST__` (see `core/frontend/vite.config.ts` + `utils/api.ts`).

## Dev/build “golden paths” (root `package.json`)
- Desktop dev (backend + Tauri): `pnpm dev:tauri`
- Mobile dev (backend + Tauri iOS): `pnpm dev:tauri:ios`
- Mobile dev (backend + Tauri Android): `pnpm dev:tauri:android`
- Web dev (backend + Vite): `pnpm dev:web`
- Desktop build: `pnpm build:tauri`
- Mobile build (iOS): `pnpm build:tauri:ios`
- Mobile build (Android): `pnpm build:tauri:android`
- Web build (Vite): `pnpm build:web`
- Lint: `pnpm lint` (or `pnpm lint:frontend`, `pnpm lint:backend`)
- Backend standalone: `pnpm --filter @tiny-chat/core-backend dev`
  - uses `node --watch src/server.ts -- --dev --` (see `core/backend/package.json`).
- Helper: `tools/wait-for-backend.ts` waits on `http://localhost:$VITE_BACKEND_PORT`.

## Runtime configuration / env contracts
- Root scripts run under `dotenv -- ...` so `.env` at repo root is expected.
- Backend loads `.env` explicitly: `core/backend/src/server.ts` resolves `../../../.env`.
- Required backend env (observed in code):
  - Postgres: `PG_USER`, `PG_PASSWORD`, `PG_HOST`, `PG_PORT`, `PG_DATABASE`
  - URLs/ports/paths: `VITE_BACKEND_PORT`, `VITE_BACKEND_URL`, `VITE_WEB_PORT`, `VITE_WEB_URL`, `VITE_BACKEND_PATH_TRPC`, `VITE_BACKEND_PATH_AUTH`
  - OAuth: `AUTH_GITHUB_CLIENT`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_CLIENT`, `AUTH_GOOGLE_SECRET`

## Persistence / data model
- Prisma + Postgres; generated client lives in `core/backend/generated/prisma` (schema in `core/backend/prisma/schema.prisma`).
- Backend sets a global singleton `globalThis.prisma` (declared in `core/backend/src/index.ts`) and passes it via tRPC context.

## Project-specific conventions
- Routes are assembled by composition: `core/backend/src/server.ts` imports `./routes/*` and passes them into `router({ folders, chats, ... })`.
- UI routing uses hash history (`wouter` + `useHashLocation` in `core/frontend/src/main.tsx`) to work in Tauri/file-based hosting.
- Log plumbing is shared: frontend initializes backend logger (`initLogs` imported from `@tiny-chat/core-backend/src/logs.ts`).

## When changing APIs
- Keep server+client in lockstep: tRPC type is imported from backend (`type tRPC` from `core-backend/src/server`) into `core/frontend/src/utils/api.ts`.
- Auth changes impact:
  - `core/backend/src/server.ts` (better-auth config/paths/trusted origins)
  - `core/frontend/src/App.tsx` token/session bootstrap + anonymous sign-in

