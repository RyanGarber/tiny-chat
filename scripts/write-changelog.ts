#!/usr/bin/env node

// Expands squashed commits for @semantic-release/commit-analyzer and
// @semantic-release/release-notes-generator, and writes the latest
// changelog to CHANGES.md and CHANGELOG.md.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// @ts-ignore
import { analyzeCommits as _analyzeCommits } from '@semantic-release/commit-analyzer';
// @ts-ignore
import { generateNotes as _generateNotes } from '@semantic-release/release-notes-generator';

const changesFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../CHANGES.md');
const changelogFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../CHANGELOG.md');

const PRESET_CONFIG = {
  preset: 'conventionalcommits',
  presetConfig: { preMajor: true },
};

const CONVENTIONAL_HEADER = /^(\w+)(\(.+\))?!?: .+$/;

/**
 * Expand any squash-merged commit into one virtual commit per
 * conventional-commit header in its message body.
 */
export function splitSquashedCommits(commits: any[]): any[] {
  return commits.flatMap((commit) => {
    const paragraphs: string[] = commit.message.split(/\n\n+/).filter(Boolean);

    const headerIndices = paragraphs
      .map((p, i) => (CONVENTIONAL_HEADER.test(p.split('\n')[0]) ? i : -1))
      .filter((i) => i !== -1);

    // 0 or 1 header-like paragraphs: this is a normal commit, not a squash.
    if (headerIndices.length <= 1) return [commit];

    return headerIndices.map((startIdx, n) => {
      const endIdx = n + 1 < headerIndices.length ? headerIndices[n + 1] : paragraphs.length;
      // Fold every paragraph up to the next header into this virtual commit
      const message = paragraphs.slice(startIdx, endIdx).join('\n\n');
      return {
        ...commit,
        message,
        // Keep hashes unique per virtual commit
        hash: n === 0 ? commit.hash : `${commit.hash}-${n}`,
      };
    });
  });
}

export function prependFileSync(path: string, data: string) {
  const existing = existsSync(path) ? readFileSync(path, 'utf-8').trim() : null;
  writeFileSync(path, `${data}\n${existing ? `\n${existing}\n` : ''}`, 'utf-8');
}

export async function analyzeCommits(_pluginConfig: any, context: any) {
  const commits = splitSquashedCommits(context.commits ?? []);
  return _analyzeCommits(PRESET_CONFIG, { ...context, commits });
}

export async function generateNotes(_pluginConfig: any, context: any) {
  const commits = splitSquashedCommits(context.commits ?? []);
  const notes = await _generateNotes(PRESET_CONFIG, { ...context, commits });

  context.nextRelease.notes = notes;

  writeFileSync(changesFile, notes ?? '');
  prependFileSync(changelogFile, notes ?? '');
  return notes;
}
