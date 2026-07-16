import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_ENVIRONMENT_VARIABLES = [
  "GITHUB_SHA",
  "GITHUB_RUN_ID",
  "GITHUB_RUN_ATTEMPT"
];

export async function writeBuildInfo({
  env = process.env,
  outputDirectory = path.resolve(process.cwd(), "dist"),
  now = () => new Date()
} = {}) {
  const missingVariables = REQUIRED_ENVIRONMENT_VARIABLES.filter(
    (name) => typeof env[name] !== "string" || env[name].trim() === ""
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Cannot write deployment version manifest: missing required environment variables: ${missingVariables.join(
        ", "
      )}`
    );
  }

  const manifest = {
    sha: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    builtAt: now().toISOString()
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "version.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  return manifest;
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  writeBuildInfo()
    .then((manifest) => {
      console.log(`Wrote dist/version.json for ${manifest.sha}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
