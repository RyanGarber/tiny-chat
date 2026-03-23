import type { Chat } from '../../generated/prisma/client.ts';
import type { User } from '../server.ts';
import type { zConfig } from '../types.ts';
import { type ContextItem, getNextRunAt, texts, zData } from '../types.ts';
import { getMemoryContext } from '../routes/embeddings.ts';

const GITHUB_IGNORE = [
  // 1. Version Control & Git
  '.git/',
  '.gitignore',
  '.gitattributes',
  '.gitmodules',

  // 2. Package Managers & Lockfiles
  'node_modules/',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'composer.lock',
  'mix.lock',
  '.pnp.cjs',
  '.pnp.loader.mjs',
  '.yarn/',

  // 3. Build Outputs, Framework Dirs & Compiled Code
  'dist/',
  'build/',
  'out/',
  'target/',
  'bin/',
  'obj/',
  '.next/',
  '.nuxt/',
  '.svelte-kit/',
  '.output/',
  '__pycache__/',
  '.pytest_cache/',

  // 4. Compiled Binaries & Bytecode
  '.class',
  '.o',
  '.so',
  '.dll',
  '.exe',
  '.dylib',
  '.pyc',
  '.pyo',
  '.jar',
  '.war',
  '.a',
  '.lib',

  // 5. Minified & Bundled Frontend Assets
  '.min.js',
  '.min.css',
  '.bundle.js',
  '.bundle.css',
  '.map', // Source maps (massive JSON)

  // 6. Media, Fonts & Binary Assets
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.svg', // Optional to ignore, but usually too noisy for LLMs
  '.mp3',
  '.mp4',
  '.wav',
  '.mov',
  '.ttf',
  '.woff',
  '.woff2',
  '.eot',
  '.otf',

  // 7. Archives & Documents
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.pdf',
  '.docx',
  '.xlsx',

  // 8. Logs, Databases & Data Dumps
  '.log',
  '.sqlite',
  '.sqlite3',
  '.db',
  '.rdb',
  '.csv',
  '.tsv',
  '.jsonl',

  // 9. IDE, OS & Environment Configs
  '.env', // Never embed secrets!
  '.env.local',
  '.env.development',
  '.env.production',
  '.DS_Store',
  'Thumbs.db',
  '.idea/',
  '.vscode/',
  '.vs/',
  '.suo',
  '.sln',

  // 10. Testing & Coverage
  'coverage/',
  '.nyc_output/',
  'playwright-report/',
  'test-results/',
];

export function includeGitHubFile(path: string): boolean {
  return !GITHUB_IGNORE.some(
    (match) => path.includes(`/${match}`) || path.endsWith(match) || path === match,
  );
}

const GITHUB_EMBED = [
  // 1. Code & Markup Files
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.svg',
  '.md',
  '.mdx',
  '.txt',
  '.csv',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less',

  // 2. Configurations & Scripts
  'Dockerfile',
  'Makefile',
  'CMakeLists.txt',

  // 3. Source Code in Popular Languages
  '.py', // Python
  '.rb', // Ruby
  '.go', // Go
  '.rs', // Rust
  '.java', // Java
  '.kt', // Kotlin
  '.swift', // Swift
  '.c', // C
  '.cpp', // C++
  '.h', // C/C++ headers
  '.sh', // Shell scripts
  '.bash',
  '.zsh',
  '.fish',
];

export function embedGitHubFile(path: string) {
  return GITHUB_EMBED.some((extension) => path.toLowerCase().endsWith(extension));
}

export async function generateInstructions(
  user: User,
  messages: ContextItem[],
  config: zConfig,
  chat?: Chat,
) {
  const memories = chat && !chat.incognito ? await getMemoryContext(user, messages) : [];

  const actions = chat
    ? await globalThis.prisma.action.findMany({
        where: { chatId: chat.id },
      })
    : [];

  const userInstructions = chat && !chat.incognito ? user.settings.instructions : [];

  return (
    `Formatting re-enabled.

## Instructions

Today's date is ${new Date().toLocaleDateString()}. For time-sensitive topics (news, software, etc.), search rather than relying on training data.
Always take conversation timing into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages.

Render responses in Markdown — use headers, tables, lists, and code blocks where helpful. Use LaTeX for math. Keep paragraphs short.

When using actions, memories, or (CRITICAL) results from the search_web tool, always cite your sources using footnotes like [^id] (e.g., [^abcdef]) matching the "id" field exactly.
Do NOT use simple [^1] indices; only use the explicit [^id] IDs provided in the results.
Do NOT repeat the list of sources at the end of your response; the system will display them automatically.

## Identity

This conversation may include responses from multiple AI models. Your model name is "${config.model}".
Only messages labeled [assistant:model=${config.model}] were written by you. Other assistant messages were written by different models that may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I" if it wasn't "${config.model}". Critique past assistant messages from your own perspective when appropriate.

Critical: Do not include the [assistant:model=...] label in your response.

## Context

The user's scheduled actions in this chat:

${
  actions.length
    ? (
        await Promise.all(
          actions.flatMap(async (a) =>
            (await getNextRunAt(a))
              ? [`- [${a.id}] ${texts(zData.parse(a.data))} (${a.schedule})`]
              : [],
          ),
        )
      ).join('\n')
    : '- (none)'
}

Relevant memories of the user across all chats:

${memories.length ? memories.map((m) => `- ${m}`).join('\n') : '- (none)'}

## Actions

Actions allow for prompts to be sent automatically on a recurring schedule.
If the user asks for regular updates on a topic, use the add_action tool to create an action for it.
If regular updates would be useful for a topic, but the user hasn't asked yet, ask proactively if they'd like an action created.

## Memories

When the user shares information that could improve future chats, store it as memory even if it was mentioned only once.
Save anything that could be useful in the future, even if it's not obvious now. When unsure, prefer storing the memory with an appropriate confidence score rather than skipping it entirely.
When discussing code, pay special attention to the user's tech stack, environment, architectural decisions, and pain points.
SHORT_TERM and MEDIUM_TERM memories are encouraged for active conversations, experiments, or temporary workflows.
Do not bring up or make connections to a memory unless it is directly relevant to the current conversation.` +
    (userInstructions?.length
      ? `

## User

The user provided the following instructions:

${userInstructions.join('\n')}`
      : '')
  );
}
