import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { writeBuildInfo } from "./write-build-info.mjs";

test("writes an exact deployment version manifest", async (context) => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "risk-adjustment-build-info-")
  );
  context.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const builtAt = new Date("2026-07-16T18:25:43.000Z");

  const manifest = await writeBuildInfo({
    env: {
      GITHUB_SHA: "abc123",
      GITHUB_RUN_ID: "456",
      GITHUB_RUN_ATTEMPT: "2"
    },
    outputDirectory: temporaryDirectory,
    now: () => builtAt
  });

  assert.deepEqual(manifest, {
    sha: "abc123",
    runId: "456",
    runAttempt: "2",
    builtAt: "2026-07-16T18:25:43.000Z"
  });
  assert.deepEqual(
    JSON.parse(await readFile(path.join(temporaryDirectory, "version.json"), "utf8")),
    manifest
  );
});

test("fails clearly when GitHub deployment metadata is missing", async () => {
  await assert.rejects(
    writeBuildInfo({ env: {} }),
    /missing required environment variables: GITHUB_SHA, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT/
  );
});
