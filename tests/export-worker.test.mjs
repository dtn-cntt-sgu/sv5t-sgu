import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Run the actual entry point without credentials: all imports must resolve before
// configuration validation. This catches incompatible dependency exports without
// claiming jobs, contacting storage or reading the local environment file.
test("export worker imports successfully and reaches environment validation", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/export-worker.mjs", "--once", "--exports-only"],
    {
      cwd: process.cwd(),
      env: {},
      encoding: "utf8",
      timeout: 15000,
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(result.stderr, /SyntaxError|does not provide an export/);
});
