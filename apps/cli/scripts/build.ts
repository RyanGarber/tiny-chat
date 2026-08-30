#!/usr/bin/env bun

import { compile } from "./compile.ts";

const result = await compile({ compile: { outfile: "./dist/tiny-chat" } });

process.exit(result?.success ? 0 : 1);
