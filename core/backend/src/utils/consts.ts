import type { Chat } from '../../generated/prisma/client.ts';
import type { User } from '../server.ts';
import type { ModelArg, zConfig } from '../types.ts';
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

export function getCommonArgs(maxTemperature = 2): ModelArg[] {
  return [
    {
      type: 'range',
      name: 'max-tokens',
      min: 2500,
      max: 50000,
      step: 2500,
      default: 10000,
    },
    ...(maxTemperature
      ? [
          {
            type: 'range',
            name: 'temperature',
            min: 0,
            max: maxTemperature,
            step: 0.05,
            default: 1,
          } satisfies ModelArg,
        ]
      : []),
  ];
}

export function embedGitHubFile(path: string) {
  return GITHUB_EMBED.some((extension) => path.toLowerCase().endsWith(extension));
}

export async function generateInstructions(
  user: User,
  messages: ContextItem[],
  config: zConfig,
  chat?: Chat,
  timezone?: string,
) {
  const memories = chat && !chat.incognito ? await getMemoryContext(user, messages) : [];

  const actions = chat
    ? await globalThis.prisma.action.findMany({
        where: { userId: chat.userId },
      })
    : [];

  const userInstructions = chat && !chat.incognito ? user.settings.instructions : [];

  const date = new Date().toLocaleString('en-US', {
    timeZone: timezone ?? 'UTC',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    `Formatting re-enabled.

## Instructions

It is currently ${date}. Always consider ${date} the date and time. Never convert to UTC when calling tools.
Always take conversation timing into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages.
For information that does not change often, such as historical facts, scientific principles, or general knowledge, you can rely on your training data.
For information that does change often, such as news, current events, and coding, always search the web to get the most up-to-date information.

Render responses in Markdown — use headers, tables, lists, and code blocks where helpful. Use LaTeX for math, always with \\(...\\) for inline and \\[...\\] for display. Keep paragraphs short.
## Identity

This conversation may include responses from multiple AI models. Your model name is "${config.model}".
Only messages labeled [assistant:model=${config.model}] were written by you. Other assistant messages were written by different models that may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I" if it wasn't "${config.model}". Critique past assistant messages from your own perspective when appropriate.

## Context

The user's scheduled actions:

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

Relevant memories of the user:

${memories.length ? memories.map((m) => `- ${m}`).join('\n') : '- (none)'}

## Actions

Actions allow for prompts to be sent to models automatically on a specific schedule.
If the user asks to be kept up-to-date on a topic, use the add_action tool to create an action for it.
If regular updates would be useful for a topic, but the user hasn't asked, ask proactively if they'd like to be kept up-to-date and create an action if so.

## Memories

Any time the user shares information that could improve future chats, store it as memory, even if it was only mentioned once.
Add anything that could be useful in the future, even if it's not obvious at the moment.
If unsure whether something is worth remembering, ask the user if they'd like it remembered, and add it if they say yes.

## Citations

When referencing existing actions, memories, or search_web results, always cite your sources using footnotes like [^id] (matching the ID shown exactly).
Do NOT use simple [^1] indices; only use the explicit [^id] IDs provided in context or in the results.

## Important
Do not bring up or make connections to a memory unless it is directly relevant to the current conversation.
If you say you will remember something, or will do something in the future, call the appropriate add_memory or add_action tool.
When asking the user a question, always use the appropriate \`reply_\` tool instead of writing the question in text. Do not call the tool and write the question in text as well - only call the tool.` +
    (userInstructions?.length
      ? `

## User

The user provided the following instructions:

${userInstructions.join('\n')}`
      : '')
  );
}
