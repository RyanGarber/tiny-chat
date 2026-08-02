# AGENTS.md (tiny-chat)

## Big picture

- PNPM workspace monorepo (`pnpm-workspace.yaml`) with:
	- `packages/server`: Node HTTP server exposing **tRPC** + **better-auth** + small `/@/antigravity` and `/@/upload`
	  endpoints.
	- `packages/app`: Vite + React (Mantine) UI; ships inside Tauri or as web build.
	- `apps/tauri`: Tauri v2 shell for desktop/iOS/Android.
	- `apps/web`: Fastify static host for `packages/app` build output.

## How components talk

- Frontend calls backend over HTTP:
	- tRPC base path: `CommonUtils.endpoints.api` (server delegates to a tRPC HTTP handler created with
	  `createHTTPHandler`
	  in `packages/server/src/core/services/ApiService.ts`, mounted by `packages/server/src/server.ts`).
	- Auth base path: `CommonUtils.endpoints.auth`.
- Auth is **Bearer token** driven:
	- UI stores `token` in `sessionStorage` (see `packages/app/src/App.tsx`).
	- tRPC client sends `Authorization: Bearer <token>` (see `packages/app/src/client.ts`).
- In dev, URLs are computed from ports/hosts; Tauri dev host uses `TAURI_DEV_HOST` / `__TAURI_DEV_HOST__` (see
  `packages/app/vite.config.ts` + `/client.ts`).

## Dev/build "golden paths" (root `package.json`)

- Desktop dev (backend + Tauri): `pnpm dev:tauri`
- Mobile dev (backend + Tauri iOS): `pnpm dev:tauri:ios`
- Mobile dev (backend + Tauri Android): `pnpm dev:tauri:android`
- Web dev (backend + Vite): `pnpm dev:web`
- Mobile builder helpers: `pnpm open:tauri:ios`, `pnpm open:tauri:android` (dev + open in IDE)
- Desktop build: `pnpm build:tauri`
- Mobile build (iOS): `pnpm build:tauri:ios`
- Mobile build (Android): `pnpm build:tauri:android`
- Web build (Vite): `pnpm build:ui`
- Lint: `pnpm lint` (or `pnpm lint:frontend`, `pnpm lint:backend`)
- Backend standalone: `pnpm dev:server` (runs via `node --watch` for hot reload)
- Backend production: `pnpm start:server`
- Helper: `scripts/use-server.ts` polls `http://localhost:$VITE_SERVER_PORT` before starting frontend dev servers.

## Runtime configuration / env contracts

- Root scripts run under `dotenv -- ...` so `.env` at repo root is expected.
- Backend loads `.env` explicitly: `packages/server/src/server.ts` resolves `../../../.env`.
- Required backend env (observed in code):
	- Postgres: `PG_USER`, `PG_PASSWORD`, `PG_HOST`, `PG_PORT`, `PG_DATABASE`
	- URLs/ports/paths: `VITE_SERVER_PORT`, `VITE_SERVER_URL`, `VITE_WEB_PORT`, `VITE_WEB_URL`
	- OAuth: `AUTH_GITHUB_CLIENT`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_CLIENT`, `AUTH_GOOGLE_SECRET`, ...

## Persistence / data model

- Prisma + Postgres; generated client lives in `packages/server/generated/prisma` (schema in
  `packages/server/prisma/schema.prisma`).
- Backend sets a global singleton `globalThis.prisma` (declared in `packages/server/src/index.ts`) and passes it via
  tRPC context.

## Monorepo & dependencies

- **pnpm workspace** with package filters: `pnpm --filter @tiny-chat/<package> <script>` targets specific workspaces
- **Workspace packages**: `@tiny-chat/app`, `@tiny-chat/server`, `@tiny-chat/tauri`, `@tiny-chat/web`, `@tiny-chat/cli`,
  `@tiny-chat/core`
- **Internal imports**: Use workspace protocol (`"@tiny-chat/core": "workspace:*"`); frontend imports backend
  types/utils via `@tiny-chat/core/src/...`
- **Patches** (applied in `pnpm-workspace.yaml`):
	- `@ai-sdk/google`, `@google/gemini-cli-core`, `ai-sdk-provider-gemini-cli`: Local patches for version compatibility
	  or fixes
- **TypeScript paths**: Base `tsconfig.base.json` enforces strict mode, no unused variables/parameters
- **Dependency constraints**: See `pnpm-workspace.yaml` → `allowedDeprecatedVersions`, `allowBuilds` (prisma, sharp,
  esbuild must build natively)

## Project-specific conventions

- **Routes**: Assembled by composition in `packages/server/src/server.ts`; each route file exports a
  `router({ procedure })` with tRPC procedures:
	- `procedure.query()` or `.mutation()` for endpoints
	- `.input(zod schema)` for validation
	- Each handler receives `{ ctx, input }` where `ctx.session.user` is the authenticated user
	- Examples: `routes/chats.ts`, `routes/folders.ts`, `routes/messages.ts`, etc.
- **Services**: Standalone logic in `packages/server/src/services/`:
	- `AntigravityService.ts`: Antigravity provider streaming endpoint (`/@/antigravity`) — uses
	  `ai-sdk-antigravity-proxy` + `ai`'s `streamText` to provide SSE-style streamed events. The handler expects a JSON
	  body and a JSON-stringified AntigravityAccount in `X-Antigravity-Account` for oauth flow.
	- `upload.ts`: File upload handling (`/@/upload`)
	- `ApiContext.ts`: Creates the tRPC HTTP handler (`createHTTPHandler`) and tRPC request context (extracts session
	  via
	  `auth.api.getSession` using `authHeaders`) — this is where tRPC's basePath and max body size are configured.
- **Providers**: AI model families in `packages/server/src/providers/`:
	- Base interface in `base.ts` (name, settings, check method)
	- `chat/` folder: Chat model providers (via AI SDK + local integrations)
	- `web/`, `other/`: Additional capabilities (embedding, web search, etc.)
	- Each provider exposes `.check(user)` to test API key validity
- **Families**: Model-specific configuration in `packages/server/src/families/`:
	- Export model families (e.g., ChatFamily, OpenAI, Anthropic) matching AI providers
	- Each family defines `getArgs(model)` for UI parameter definitions
- **Tools**: Utility functions for generation in `packages/server/src/tools/` (e.g., file search, github)
- **Utils**: Shared helpers in `packages/server/src/utils/`:
	- `logger.ts`: Console log interception + disk logging (used by frontend)
	- `agent.ts`: Message generation orchestration
	- `embed.ts`: Embedding lookups
	- `sse.ts`: Server-Sent Events helpers
- **Worker**: `packages/server/src/worker.ts` + timed tick in `server.ts` for scheduled actions:
	- Runs every 5 seconds checking `prisma.action` for due tasks
	- Executes stored chats with predefined configs (scheduling/reminders)
- **UI Routing**: Hash-based (`wouter` + `useHashLocation` in `packages/app/src/main.tsx`):
	- Enables file-based hosting in Tauri and web builds
	- Deep linking works via `window.location.hash`
- **State Management**: Zustand stores in `packages/app/src/stores/`:
	- Patterns: `useStore.getState().init()` for hydration, subscriptions for UI sync
	- Main stores: `chats`, `folders`, `messages`, `settings`, `tasks`, `providers`, `persistence`, `layout`
- **Log Plumbing**: Shared between backend and frontend:
	- Backend initializes via `initLogs(write?, writeToDisk)` in `packages/core/src/logger.ts`
	- Frontend initializes in `packages/app/src/main.tsx` passing logger callback
	- Console methods (log, info, warn, error, trace) are intercepted and streamed to UI

## When changing APIs

- **tRPC routes**: Keep server+client in lockstep:
	- Route type exported from backend (`type ApiRouter` from `packages/server/src/core/ApiRouter.ts`)
	- Frontend imports into `packages/app/client.ts` for type-safe client generation
	- Always include `.input(zod schema)` for validation; Zod type is inferred on client
- **Adding new routes**: Create file in `packages/server/src/routes/`, export `router({ ... })`, then add to
  `server.ts` router composition
- **Auth changes** impact:
	- `packages/server/src/server.ts` (better-auth config, basePath, trustedOrigins, socialProvider keys)
	- `packages/app/src/App.tsx` (token storage, session bootstrap, anonymous sign-in fallback)
	- Better-auth plugins: `anonymous()` (data migration on account link) + `bearer()` (token auth)
- **Services & endpoints**: Keep in sync:
	- `/@/antigravity` → `AntigravityService.ts` (streaming AI responses via SSE). The endpoint expects a JSON payload
	  (model, prompt, tools, providerOptions) and reads an account from `X-Antigravity-Account` (used to authenticate
	  with Google).
	- `/@/upload` → `upload.ts` (file upload, returns file metadata)
	- Both are HTTP routes _outside_ the tRPC router (they perform their own auth checks via `auth.api.getSession`/
	  `authHeaders` where appropriate).
- **Provider/family changes**: Update both:
	- New AI family → add to `families/` + `providers/chat/`
	- Always expose `.check(user)` method to validate user's credentials (API keys, etc.)
