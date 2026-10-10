#!/usr/bin/env node
// Everything in public/ is copied into the exported site, including the local test library.
// It must never ship, so the build removes it.

import fs from "node:fs";

fs.rmSync("out/dev-fixtures", { recursive: true, force: true });
