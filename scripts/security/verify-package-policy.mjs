import { readFileSync } from "node:fs";
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

if (errors.length > 0) {
  console.error("Package policy verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Package policy verified for ${projects.length} projects and ${directDependencyCount} direct pins.`);
  console.log(
    `${installScriptPackages.length} locked packages declare install scripts; project policy prevents their execution.`,
  );
  for (const entry of installScriptPackages) console.log(`- ${entry}`);
}
