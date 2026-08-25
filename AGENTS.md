# AGENTS.md (tiny-chat)

Tiny Chat is one chat app — web, desktop, mobile, and CLI — not three products (Chat / Cowork / Code). Agentic coding
should be state of the art, but the same surfaces, tools, and data model have to stay equally good for a non-coding
conversation. Do not introduce a "code mode", a separate coding agent, or features that only make sense if the user is
in a repo.

## Layers — put the change in the right package

pnpm workspace (`apps/*`, `packages/*`). No package `exports` field. Imports are deep paths with `.ts` / `.tsx`
suffixes:

`@tiny-chat/core/src/...`, `@tiny-chat/client/src/...`, `@tiny-chat/server/src/...`

`packages/app` also has `#app/*`, `#client/*`, `#core/*`, `#server/*`.

```
core  ←  server
core  ←  client  ←  app, cli
server types only  ←  client (ApiRouter, AuthServer)
app dist  ←  web (static host), tauri (native shell)
```

| Package           | Role                                                                                                             | May import                                                                                                    | Must not                         |
|-------------------|------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|----------------------------------|
| `packages/core`   | Domain: types, providers, agent loop, tools, file/search utils. No React, no HTTP, no Prisma client.             | nothing in the monorepo (Prisma *types* from `packages/server/generated/prisma/browser.ts` are the exception) | client, server runtime, app, cli |
| `packages/server` | Node HTTP: tRPC, better-auth, Prisma, virtual FS, worker.                                                        | core                                                                                                          | client, app, cli                 |
| `packages/client` | Shared React runtime for app + CLI: `createClient`, Query/tRPC/auth, zustand, hooks, **interactive generation**. | core + server *types*                                                                                         | app, cli                         |
| `packages/app`    | Vite + React + Mantine UI (web + Tauri webview). Runtime adapters (browser/Tauri providers, MCP, host shell).    | client, core, server                                                                                          | —                                |
| `apps/cli`        | Ink terminal UI over the same client. Bun. OS keyring + real FS shell.                                           | client, core, server                                                                                          | —                                |
| `apps/web`        | Fastify static host of the app build.                                                                            | —                                                                                                             | —                                |
| `apps/tauri`      | Tauri v2 shell (desktop / iOS / Android): FS, shell, MCP, AFM. Loads the app.                                    | —                                                                                                             | —                                |

If both app and CLI need a behavior, it belongs in `client` (or `core`). If only one runtime can do it (Mantine vs Ink,
Tauri invoke vs `node:fs`), it belongs in that runtime's `client.ts` adapter or its own `features/`.

## Feature folders

Every package uses `src/features/<domain>/{components,hooks,services,stores,utils,types,routes}`
plus `src/core/` for cross-cutting infra (auth, capabilities, client bootstrap, theme — not a domain).

Not every feature has every subfolder. Do not invent a parallel tree (`src/services/`, `src/utils/` at package root,
`src/providers/`).

| Kind       | File                     | Shape                                                                |
|------------|--------------------------|----------------------------------------------------------------------|
| Service    | `FooService.ts`          | `export const FooService = { ... } as const`                         |
| Utils      | `FooUtils.ts`            | same, pure helpers                                                   |
| Hook       | `useFoo.ts`              | `useContext(ClientContext)` for API access                           |
| Component  | `Foo.tsx`                | PascalCase                                                           |
| Types      | `foo.ts`                 | Zod schemas named `zFoo`; `FooState`; `FooLike` = `{ id } \| string` |
| Tool       | `read_file.ts`           | snake_case definition + `createReadFileTool` factory                 |
| Capability | `createFooCapability.ts` | factory returning a `*Capability` from `core/types/capability.ts`    |
| Route      | `foo.ts`                 | `router({ procedure })` from `packages/server/src/index.ts`          |

Existing feature names (do not rename casually — match these):

- **core:** `agent`, `data`, `file`, `provider`, `skill`, `tool`
- **client:** `agent`, `chat`, `editor`, `message`, `part`, `settings`, `upload`, `user`
- **server:** `chat`, `embedding`, `file`, `message`, `proxy`, `upload`, `user`, `worker`
- **app:** `chat`, `code`, `editor`, `message`, `part`, `sidebar`, `tauri`, `upload`
- **cli:** `agent`, `chat`, `code`, `editor`, `message`, `part`, `settings`, `update`, `upload`

`part` is message parts (tool calls, thoughts, attachments) — not `features/tool`.

## How the pieces talk

Interactive chats do **not** generate on the server. The client creates/updates messages via tRPC, then runs
`AgentService.generate` in-process.

```
UI (app | cli)
  → createClient (token, storage, shell, MCP transports, extra providers)
  → tRPC  /@/api     persistence, settings, virtual FS, uploads, web proxy
  → auth  /@/auth    better-auth (anonymous + bearer)
  → ClientAgentService → ClientCapabilityService + ToolService
       → AgentService.generate (core) → stream into StreamService / ToolStreamService
       → message.updateMessage
```

Scheduled **actions** (reminders / recurring prompts) are the exception: the server worker ticks every 5s and runs the
same `AgentService.generate` with
`ServerCapabilityService`.

HTTP surface (`packages/server/src/server.ts`), paths from `CommonUtils.endpoints`:

| Path             | Handler                                                |
|------------------|--------------------------------------------------------|
| `/@/api`         | tRPC (`ApiService`, `ApiRouter`)                       |
| `/@/auth`        | better-auth (`AuthServer`)                             |
| `/@/mcp`         | CORS MCP proxy (`X-Mcp-Url`)                           |
| `/@/antigravity` | SSE Google/Antigravity relay (`X-Antigravity-Account`) |

There is no standalone `/@/upload` HTTP route. Uploads are tRPC `upload.*`.

Auth: Bearer token. App keeps it in `localStorage`; CLI in the OS keyring.
`ApiContext` rejects unauthenticated tRPC. Social: GitHub, Google, HuggingFace.

tRPC is composed in `packages/server/src/core/utils/ApiRouter.ts`:

`user`, `chat`, `file`, `action`, `memory`, `upload`, `settings`, `embedding`,
`message`, `web`, `testing`

Client types it as `createTRPCClient<ApiRouter>`. Adding a namespace: write the route file, add it to `ApiRouter`,
consume `client.api.<ns>.*`. Always `.input(zod)`.

`testing.worker` / `testing.tool` exist only when `DEV` is truthy.

## Agent, tools, capabilities

Three layers, do not collapse them:

1. **Capability** — a host-facing interface (`WebCapability`, `ShellCapability`,
   `UserCapability`, `EmbeddingCapability`) in
   `packages/core/src/core/types/capability.ts`. Implemented twice:
	- client: `packages/client/src/core/capabilities/` (tRPC / `client.shell`)
	- server: `packages/server/src/core/capabilities/` (Prisma / `FileService`)
	  Assembled by `ClientCapabilityService` / `ServerCapabilityService`.
2. **Tool** — a model-facing `ToolDefinition` + `execute`. Lives only in core (`packages/core/src/features/tool/`).
   Depends on capabilities, never on tRPC or Prisma. `validate` runs before approval; `onOutput` streams live output
   that must also appear in the resolved result (streamed chunks are not persisted).
3. **Toolset** — named group from `ToolService.getTools`. Enabled per message via
   `config.toolsets`. Default (`DEFAULT_TOOLSETS` in `data/types/message.ts`):
   `questions`, `actions`, `memories`, `web`, `shell`.

### Two shells — do not mix them

|          | `chatShell` → tools prefixed `chat_`                                                              | `shell` → unprefixed                            |
|----------|---------------------------------------------------------------------------------------------------|-------------------------------------------------|
| Backing  | Virtual FS in Postgres (`FilesystemService` / just-bash), mounted at `/mnt`                       | The user's real machine (`client.shell`)        |
| When     | Always (web included). Scratchpad, attachments, skills, Python.                                   | Desktop Tauri and CLI only (`client.desktop`)   |
| Writable | Only `/mnt/chat/<chatId>`. `/mnt/uploads/<id>` and `/mnt/skills/<id>` are read-only shared trees. | User's files                                    |
| Rule     | `chat_*` tools *inside* `/mnt`; never outside                                                     | Unprefixed tools *outside* `/mnt`; never inside |

Dedicated file tools (`read_file`, `edit_file`, `find_files`, `grep_files`,
`search_files`, `read_dir`, `write_file`) beat `ls` / `cat` / `find` / `grep` /
`sed`. Searches are capped and skip noise; a thin result set means a narrower query, not a bigger limit.

MCP servers are extra toolsets, created by the runtime's `transports` (Tauri invoke vs Node stdio/HTTP). They are not
native tools.

Skills are uploads (`UploadType.SKILL`) with a `SKILL.md`. Mounted read-only under `/mnt/skills/<id>` when enabled on
the message `config.skills`.

### Generation path

- Interactive: `useMessaging` → `ClientAgentService.onMessage` →
  `AgentService.generate`. Message routes are CRUD only.
- Scheduled: `WorkerService.next` → same `AgentService` + server capabilities.
- `AgentInstructionsService` is shared. Coding guidance lives there as one section of a general assistant prompt — do
  not fork a coding-only prompt.

Providers live in **core** (`features/provider/providers/{model,web,other}/`), not on the server. Each exposes
`getStatus({ user })`. App may inject extra model providers (WebLLM, AFM) via `createClient({ providers })`.

## Data (enough to not guess)

Prisma + Postgres. Schema: `packages/server/prisma/schema.prisma`. Client:
`packages/server/generated/prisma`. Runtime singleton: `prisma` from
`packages/server/src/db.ts` (`globalThis.prisma`).

Core domain types wrap those models and add Zod for JSON columns (`features/data/types/`). Changing a Prisma model means
updating the matching core type.

- **Message `data`:** `zData = zDataPart[][]` — slots of parts (`text`,
  `thought`, `file`, `json`, `toolCall`, `toolResult`, `abort`).
- **Branching:** `previousId` is a unique pointer to the parent message.
- **Chat:** belongs to a folder; `temporary` / `incognito` (incognito strips
  `user` capabilities — no memories/actions).
- **Action:** recurring prompt + rrule `schedule`; executed by the worker.
- **Memory:** user-level facts with category/stability; hybrid text + vector search.
- **Upload / File:** attachments, skills, GitHub clones; chat-owned files are the writable `/mnt/chat` tree.
  `Unsupported("vector"|"tsvector")` columns exist for search — do not treat them as ordinary Prisma scalars.

User settings (providers, MCP, theme, instructions, presets, embedding) are JSON on `User.settings`, parsed as
`zSettings`.

## Making a change — where it actually goes

**New tRPC procedure:** `packages/server/src/features/<domain>/routes/<file>.ts`, compose into `ApiRouter`. Handler uses
`ctx.session.user`. Persistence through that feature's `*Service` and `prisma`, not from the route body.

**New tool:** definition + factory under `core/.../tool/tools/<toolset>/`. Wire into the toolset factory. If it needs a
new host ability, add a capability interface *and both factories*. Then `ToolService.getTools`. Touch
`DEFAULT_TOOLSETS` only if it should be on for every new chat.

**New model/web provider:** `core/.../provider/providers/{model,web,other}/`
and register on the matching `*ProviderService.providers` list. Implement
`getStatus`. Runtime-only providers (WebLLM, AFM) go on the app `createClient`
`providers` hook, not in that list.

**New UI:** shared state/hooks/services in `client`; pixels in `app` (Mantine)
and/or `cli` (Ink). Do not import `@mantine/*` from `client` or `ink` from
`app`. `createClient` is how runtimes differ (token, storage, host shell, MCP, editor `input`).

**Host shell:** implement `ShellCapability` in the runtime `client.ts` (see app Tauri invoke vs CLI `fs`/`spawn`).
Client's `createShellCapability` just forwards to `client.shell`.

App routing is a hashbang (`#/<chatId>?…`) via `useHashbang`, synced to
`useChatStore.chatId` — not wouter.

## Testing against the real environment

Dev servers and Postgres are already running. Do not mock them, do not spin up a second database, do not invent a fake
tRPC client for product work.

Scratch files and test harnesses:

- **Server / data / FS / worker:** import the real `prisma` from
  `@tiny-chat/server/src/db.ts`. That module loads `prisma.config.ts` →
  `env.ts` → the repo-root `.env`.
- **Client / hooks / generation / UI:** `createClient` + wrap with the real
  `QueryClientProvider` (`client.queryClient`) and `ClientContext` from
  `@tiny-chat/client/src/client.ts` — the same wrapping as
  `packages/app/src/main.tsx` and `apps/cli/src/main.tsx` (see
  `apps/cli/src/test.tsx`). `createClient` parses `zEnv` from that same `.env`.

Vitest (`vitest.config.ts`) includes `packages/**/*.test.ts`. Global setup:

- `packages/core/src/tests.ts` — mocked `__TEST__` user + `TestProvider` for pure unit tests that must not hit the
  network.
- `packages/server/src/tests.ts` — waits on `localhost:$VITE_SERVER_PORT`, anonymous ephemeral user, `testClient()` for
  live API tests.

Prefer the live `prisma` / `ClientContext` path unless the test is genuinely pure (string windows, path math, markdown).
Root scripts run under `dotenv --`.

## Commands

All root scripts use the repo-root `.env`.

|                      |                                                                                      |
|----------------------|--------------------------------------------------------------------------------------|
| Web (Vite + server)  | `pnpm dev:web`                                                                       |
| Desktop              | `pnpm dev:tauri`                                                                     |
| iOS / Android        | `pnpm dev:tauri:ios` / `dev:tauri:android`                                           |
| CLI                  | `pnpm dev:cli`                                                                       |
| Server only          | `pnpm dev:server` (`node --watch`)                                                   |
| Lint / types / tests | `pnpm lint`, `pnpm check`, `pnpm test` (per-package `lint:*` / `check:*` / `test:*`) |

`scripts/use-server.ts` starts or waits on the backend before web/tauri.

Env schemas: `packages/core/src/core/types/env.ts`. Server also needs `PG_*` and
`AUTH_*_{CLIENT,SECRET}`. In `DEV`, URLs are `http://{host}:{VITE_*_PORT}`; otherwise `VITE_SERVER_URL` /
`VITE_WEB_URL`. Tauri dev host:
`TAURI_DEV_HOST` / `__TAURI_DEV_HOST__`.

## Conventions

- TypeScript: `tsconfig.base.json` — strict, no unused locals/params, import
  `.ts` extensions. Biome: tabs, double quotes, `pnpm lint` per package.
- `zData` / `zConfig` / `zUser` parsing at trust boundaries (tRPC input, Prisma JSON out). Don't pass raw `Json` around
  past the service that loaded it.
- Logger: `createLogger` in `packages/core/src/logger.ts`. Server logs to disk; app intercepts console into the in-app
  console store.
- Patches (pnpm): `@ai-sdk/google`, `sixel`. Don't "fix" those packages in
  `node_modules`.
- Keep related edits in lockstep: route ↔ `ApiRouter` ↔ client call; capability interface ↔ both factories ↔ tools that
  consume it; Prisma model ↔ core type; default toolsets ↔ agent instructions that mention them.
