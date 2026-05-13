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

## Dev/build "golden paths" (root `package.json`)
- Desktop dev (backend + Tauri): `pnpm dev:tauri`
- Mobile dev (backend + Tauri iOS): `pnpm dev:tauri:ios`
- Mobile dev (backend + Tauri Android): `pnpm dev:tauri:android`
- Web dev (backend + Vite): `pnpm dev:web`
- Mobile builder helpers: `pnpm open:tauri:ios`, `pnpm open:tauri:android` (dev + open in IDE)
- Desktop build: `pnpm build:tauri`
- Mobile build (iOS): `pnpm build:tauri:ios`
- Mobile build (Android): `pnpm build:tauri:android`
- Web build (Vite): `pnpm build:web`
- Lint: `pnpm lint` (or `pnpm lint:frontend`, `pnpm lint:backend`)
- Backend standalone: `pnpm dev:backend` (runs via `node --watch` for hot reload)
- Backend production: `pnpm start:backend`
- Helper: `scripts/wait-for-backend.ts` polls `http://localhost:$VITE_BACKEND_PORT` before starting frontend dev servers.

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

## Monorepo & dependencies
- **pnpm workspace** with package filters: `pnpm --filter @tiny-chat/<package> <script>` targets specific workspaces
- **Workspace packages**: `@tiny-chat/core-frontend`, `@tiny-chat/core-backend`, `@tiny-chat/apps-tauri`, `@tiny-chat/apps-web`
- **Internal imports**: Use workspace protocol (`"@tiny-chat/core-backend": "workspace:*"`); frontend imports backend types/utils via `@tiny-chat/core-backend/src/...`
- **Patches** (applied in `pnpm-workspace.yaml`):
  - `@ai-sdk/google`, `@google/gemini-cli-core`, `ai-sdk-provider-gemini-cli`: Local patches for version compatibility or fixes
- **TypeScript paths**: Base `tsconfig.base.json` enforces strict mode, no unused variables/parameters
- **Dependency constraints**: See `pnpm-workspace.yaml` → `allowedDeprecatedVersions`, `allowBuilds` (prisma, sharp, esbuild must build natively)

## Project-specific conventions
- **Routes**: Assembled by composition in `core/backend/src/server.ts`; each route file exports a `router({ procedure })` with tRPC procedures:
  - `procedure.query()` or `.mutation()` for endpoints
  - `.input(zod schema)` for validation
  - Each handler receives `{ ctx, input }` where `ctx.session.user` is the authenticated user
  - Examples: `routes/chats.ts`, `routes/folders.ts`, `routes/messages.ts`, etc.
- **Services**: Standalone logic in `core/backend/src/services/`:
  - `generate.ts`: AI message generation + streaming (tRPC and `/@@/generate` HTTP endpoints)
  - `upload.ts`: File upload handling
- **Providers**: AI model families in `core/backend/src/providers/`:
  - Base interface in `base.ts` (name, settings, check method)
  - `chat/` folder: Chat model providers (via AI SDK + local integrations)
  - `web/`, `other/`: Additional capabilities (embedding, web search, etc.)
  - Each provider exposes `.check(user)` to test API key validity
- **Families**: Model-specific configuration in `core/backend/src/families/`:
  - Export model families (e.g., ChatFamily, OpenAI, Anthropic) matching AI providers
  - Each family defines `getArgs(model)` for UI parameter definitions
- **Tools**: Utility functions for generation in `core/backend/src/tools/` (e.g., file search, github)
- **Utils**: Shared helpers in `core/backend/src/utils/`:
  - `logs.ts`: Console log interception + disk logging (used by frontend)
  - `generation.ts`: Message generation orchestration
  - `embed.ts`: Embedding lookups
  - `sse.ts`: Server-Sent Events helpers
- **Worker**: `core/backend/src/worker.ts` + timed tick in `server.ts` for scheduled actions:
  - Runs every 5 seconds checking `prisma.action` for due tasks
  - Executes stored chats with predefined configs (scheduling/reminders)
- **UI Routing**: Hash-based (`wouter` + `useHashLocation` in `core/frontend/src/main.tsx`):
  - Enables file-based hosting in Tauri and web builds
  - Deep linking works via `window.location.hash`
- **State Management**: Zustand stores in `core/frontend/src/stores/`:
  - Patterns: `useStore.getState().init()` for hydration, subscriptions for UI sync
  - Main stores: `chats`, `folders`, `messages`, `settings`, `tasks`, `providers`, `persistence`, `layout`
- **Log Plumbing**: Shared between backend and frontend:
  - Backend initializes via `initLogs(write?, writeToDisk)` in `core/backend/src/utils/logs.ts`
  - Frontend initializes in `core/frontend/src/main.tsx` passing logger callback
  - Console methods (log, info, warn, error, trace) are intercepted and streamed to UI

## When changing APIs
- **tRPC routes**: Keep server+client in lockstep:
  - Route type exported from backend (`type tRPC` from `core/backend/src/server.ts`)
  - Frontend imports into `core/frontend/src/utils/api.ts` for type-safe client generation
  - Always include `.input(zod schema)` for validation; Zod type is inferred on client
- **Adding new routes**: Create file in `core/backend/src/routes/`, export `router({ ... })`, then add to `server.ts` router composition
- **Auth changes** impact:
  - `core/backend/src/server.ts` (better-auth config, basePath, trustedOrigins, socialProvider keys)
  - `core/frontend/src/App.tsx` (token storage, session bootstrap, anonymous sign-in fallback)
  - Better-auth plugins: `anonymous()` (data migration on account link) + `bearer()` (token auth)
- **Services & endpoints**: Keep in sync:
  - `/@@/generate` → `generate.ts` + `continueHandler` in `server.ts` (streaming AI responses)
  - `/@@/upload` → `upload.ts` (file upload, returns file metadata)
  - Both are HTTP routes *outside* tRPC (no auth middleware; verify incoming token if needed)
- **Provider/family changes**: Update both:
  - New AI family → add to `families/` + `providers/chat/`
  - Always expose `.check(user)` method to validate user's credentials (API keys, etc.)

