import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const expectedPackageManager = "npm@11.16.0";
const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const lifecycleScriptNames = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepublish",
  "prepublishOnly",
]);
const requiredNpmConfig = {
  registry: "https://registry.npmjs.org/",
  "min-release-age": "7",
  "ignore-scripts": "true",
  "save-exact": "true",
  "package-lock": "true",
  audit: "true",
  fund: "false",
  "strict-peer-deps": "true",
};
const projects = [
  { label: "application", directory: repositoryRoot },
  { label: "contracts", directory: join(repositoryRoot, "contracts") },
];

const errors = [];
const installScriptPackages = [];
let directDependencyCount = 0;
let pinnedActionCount = 0;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateWorkflowHeredocs(name, workflow) {
  const lines = workflow.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const run = /^(\s*)run:\s*\|[-+]?\s*$/u.exec(lines[index]);
    if (!run) continue;
    const runIndent = run[1].length;
    const block = [];
    let cursor = index + 1;
    for (; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (line.trim() === "") {
        block.push(line);
        continue;
      }
      const indent = /^ */u.exec(line)[0].length;
      if (indent <= runIndent) break;
      block.push(line);
    }
    const contentIndents = block
      .filter((line) => line.trim() !== "")
      .map((line) => /^ */u.exec(line)[0].length);
    if (contentIndents.length === 0) continue;
    const contentIndent = Math.min(...contentIndents);
    const shellLines = block.map((line) => line.slice(Math.min(contentIndent, line.length)));
    for (let shellIndex = 0; shellIndex < shellLines.length; shellIndex += 1) {
      for (const match of shellLines[shellIndex].matchAll(/<<'([A-Za-z_][A-Za-z0-9_]*)'/gu)) {
        const delimiter = match[1];
        let terminator = shellIndex + 1;
        while (terminator < shellLines.length && shellLines[terminator].trim() !== delimiter) {
          terminator += 1;
        }
        if (terminator === shellLines.length) {
          errors.push(`${name}: run block has no ${delimiter} heredoc terminator`);
          continue;
        }
        if (shellLines[terminator] !== delimiter) {
          errors.push(`${name}: ${delimiter} heredoc terminator must start at shell column zero`);
        }
        shellIndex = terminator;
      }
    }
    index = cursor - 1;
  }
}

function parseNpmConfig(path) {
  const config = new Map();

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) {
      errors.push(`${path}: malformed npm configuration line`);
      continue;
    }

    config.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }

  return config;
}

function validateExactSpec(project, section, dependency, spec) {
  if (typeof spec !== "string" || !exactVersionPattern.test(spec)) {
    errors.push(
      `${project}: ${section}.${dependency} must be an exact registry version; found ${JSON.stringify(spec)}`,
    );
  }
}

function validateOverrides(project, overrides, path = "overrides") {
  for (const [name, value] of Object.entries(overrides ?? {})) {
    if (typeof value === "string") {
      validateExactSpec(project, path, name, value);
      continue;
    }

    if (value && typeof value === "object") {
      validateOverrides(project, value, `${path}.${name}`);
      continue;
    }

    errors.push(`${project}: ${path}.${name} has an unsupported override value`);
  }
}

function recordsMatch(left, right) {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

for (const { label, directory } of projects) {
  const packagePath = join(directory, "package.json");
  const lockPath = join(directory, "package-lock.json");
  const npmrcPath = join(directory, ".npmrc");
  const manifest = readJson(packagePath);
  const lockfile = readJson(lockPath);
  const npmConfig = parseNpmConfig(npmrcPath);
  const lockedRoot = lockfile.packages?.[""];

  if (manifest.packageManager !== expectedPackageManager) {
    errors.push(
      `${label}: packageManager must be ${expectedPackageManager}; found ${JSON.stringify(manifest.packageManager)}`,
    );
  }

  if (lockfile.lockfileVersion !== 3 || !lockedRoot) {
    errors.push(`${label}: package-lock.json must use lockfileVersion 3 and contain a root package`);
  }

  for (const [key, expectedValue] of Object.entries(requiredNpmConfig)) {
    if (npmConfig.get(key) !== expectedValue) {
      errors.push(
        `${label}: .npmrc must set ${key}=${expectedValue}; found ${JSON.stringify(npmConfig.get(key))}`,
      );
    }
  }

  for (const key of npmConfig.keys()) {
    if (key === "min-release-age-exclude" || key.startsWith("min-release-age-exclude[")) {
      errors.push(`${label}: release-age exclusions require an explicitly reviewed exception`);
    }
  }

  for (const scriptName of Object.keys(manifest.scripts ?? {})) {
    if (lifecycleScriptNames.has(scriptName)) {
      errors.push(`${label}: root lifecycle script ${scriptName} is not permitted`);
    }
  }

  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const declared = manifest[section] ?? {};
    const locked = lockedRoot?.[section] ?? {};

    if (!recordsMatch(declared, locked)) {
      errors.push(`${label}: package.json ${section} does not exactly match the lockfile root metadata`);
    }

    for (const [dependency, spec] of Object.entries(declared)) {
      directDependencyCount += 1;
      validateExactSpec(label, section, dependency, spec);

      const resolvedVersion = lockfile.packages?.[`node_modules/${dependency}`]?.version;
      if (resolvedVersion !== spec) {
        errors.push(
          `${label}: ${dependency} declares ${spec}, but the lockfile resolves the direct package to ${resolvedVersion ?? "nothing"}`,
        );
      }
    }
  }

  validateOverrides(label, manifest.overrides);
  for (const [dependency, spec] of Object.entries(manifest.overrides ?? {})) {
    if (typeof spec !== "string") continue;
    const resolvedVersion = lockfile.packages?.[`node_modules/${dependency}`]?.version;
    if (resolvedVersion !== spec) {
      errors.push(
        `${label}: override ${dependency} pins ${spec}, but the lockfile resolves ${resolvedVersion ?? "nothing"}`,
      );
    }
  }

  for (const [packagePathInLock, metadata] of Object.entries(lockfile.packages ?? {})) {
    if (metadata?.resolved) {
      let resolvedUrl;
      try {
        resolvedUrl = new URL(metadata.resolved);
      } catch {
        errors.push(`${label}: ${packagePathInLock} uses an invalid package source URL`);
        continue;
      }

      if (
        resolvedUrl.protocol !== "https:" ||
        resolvedUrl.hostname !== "registry.npmjs.org"
      ) {
        errors.push(`${label}: ${packagePathInLock} is not sourced from the official npm registry`);
      }

      if (!metadata.integrity) {
        errors.push(`${label}: ${packagePathInLock} has a registry tarball but no integrity digest`);
      }
    }

    if (metadata?.hasInstallScript === true) {
      installScriptPackages.push(
        `${label}:${packagePathInLock.replace(/^node_modules\//u, "")}@${metadata.version ?? "unknown"}`,
      );
    }
  }
}

const workflowDirectory = join(repositoryRoot, ".github/workflows");
for (const entry of readdirSync(workflowDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.ya?ml$/u.test(entry.name)) continue;
  const workflowPath = join(workflowDirectory, entry.name);
  const workflow = readFileSync(workflowPath, "utf8");
  validateWorkflowHeredocs(entry.name, workflow);
  if (/^\s*pull_request_target\s*:/mu.test(workflow)) {
    errors.push(`${entry.name}: pull_request_target is prohibited for this repository`);
  }
  for (const line of workflow.split(/\r?\n/u)) {
    const match = /^\s*(?:-\s*)?uses:\s*([^#]+?)(?:\s+#.*)?$/u.exec(line);
    if (!match) continue;
    const reference = match[1].trim().replace(/^(?:"([^"]+)"|'([^']+)')$/u, "$1$2");
    if (reference.startsWith("./")) continue;
    if (
      !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+@[0-9a-f]{40}$/u.test(reference) &&
      !/^docker:\/\/[^\s@]+@sha256:[0-9a-f]{64}$/u.test(reference)
    ) {
      errors.push(`${entry.name}: GitHub Action must use a full immutable commit SHA; found ${reference}`);
    } else {
      pinnedActionCount += 1;
    }
  }
}

if (errors.length > 0) {
  console.error("Package policy verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Package policy verified for ${projects.length} projects and ${directDependencyCount} direct pins.`);
  console.log(`${pinnedActionCount} GitHub Action invocations use immutable commit SHAs.`);
  console.log(
    `${installScriptPackages.length} locked packages declare install scripts; project policy prevents their execution.`,
  );
  for (const entry of installScriptPackages) console.log(`- ${entry}`);
}
