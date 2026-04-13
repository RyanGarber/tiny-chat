import type { ModelArg } from '../types.ts';

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
    ...(maxTemperature > 0
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
