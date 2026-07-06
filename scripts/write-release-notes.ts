#!/usr/bin/env node
// semantic-release plugin: dumps the generated changelog for the current
// release to disk so CI can pass it into the release workflows (which create
// the actual GitHub releases with build artifacts attached).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outputPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../RELEASE_NOTES.md',
);

export async function generateNotes(_pluginConfig: any, context: any) {
  writeFileSync(outputPath, context.nextRelease?.notes ?? '');
}
