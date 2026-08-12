import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertExactKeys,
  assertHash,
  canonicalJson,
  fetchBounded,
  headersForPolicy,
  observeEmbeddedNetworkOrigins,
  observeResponseBody,
  readJson,
  sha256Bytes,
  sha256Canonical,
  validateFrontendReleasePolicy,
  validateRouteSourceCoverageAgainstSources,
  verifyResponsePolicy,
} from "./frontend-release-common.mjs";
import { assertReleaseProfile } from "./release-profiles.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultPolicyPath = join(repositoryRoot, "src/config/frontendReleasePolicy.json");
const EMBEDDED_ORIGIN_NOISE_PATH = "src/config/reviewedEmbeddedOriginNoise.json";
// Next emits `trace` and `trace-build` as timing diagnostics containing
// per-process timestamps, durations, and trace IDs. Neither belongs to the
// standalone runtime payload, which is inventoried and compared separately.
const BUILD_EXCLUSIONS = ["cache", "diagnostics", "trace", "trace-build", "types"];
const MAXIMUM_INVENTORY_FILES = 50_000;
const MAXIMUM_INVENTORY_FILE_BYTES = 256 * 1024 * 1024;
const MAXIMUM_INVENTORY_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const FILE_KEYS = ["path", "bytes", "sha256"];
const PUBLIC_FILE_KEYS = ["sourcePath", "urlPath", "bytes", "sha256"];
const INVENTORY_KEYS = ["sha256", "fileCount", "totalBytes", "files"];
const SOURCE_MATERIAL_PATHS = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "vercel.json",
  "src/config/frontendReleasePolicy.json",
  EMBEDDED_ORIGIN_NOISE_PATH,
];
const REVIEW_ROLES = ["release-operations", "source-security"];
const APPROVAL_ENVIRONMENTS = Object.freeze({
  "release-operations": "frontend-release-operations",
  "source-security": "frontend-release-source-security",
});
const APPROVAL_WORKFLOW_PATH = ".github/workflows/frontend-release-attestation.yml";
const APPROVAL_REPOSITORY = "jh005479-sudo/lester-labs";
const APP_METADATA_PUBLIC_ARTIFACTS = Object.freeze([
  Object.freeze({ sourcePath: "src/app/favicon.ico", urlPath: "/favicon.ico" }),
]);
const EMBEDDED_ORIGIN_TEXT_EXTENSIONS = /\.(?:cjs|css|html|js|json|mjs|txt|webmanifest|xml)$/iu;
const STATIC_CONTENT_HASH_PATH = /-[0-9a-f]{16}(\.(?:css|js))$/u;
const STATIC_REVIEW_HASH_MARKER_PATH = /-\{content-hash\}(\.(?:css|js))$/u;
const NO_SERVER_ACTIONS_BUILD_KEY_DOMAIN = "lester-labs/no-server-actions-build-key/v1\0";
const DISABLED_PREVIEW_BUILD_KEY_DOMAIN = "lester-labs/disabled-preview-build-key/v1\0";
const NORMALIZED_BUILD_MANIFEST_PATHS = Object.freeze([
  "app-path-routes-manifest.json",
  "prerender-manifest.json",
  "server/app-paths-manifest.json",
]);
export const REVIEWED_FRONTEND_BUILDER_IMAGE =
  "docker.io/library/node:24.18.0-bookworm@sha256:4e9cb555d708e0829c9d93e5eeae9dfab0617b832ca436a690680e0fca735ef5";

function toPortablePath(path) {
  return path.split(sep).join("/");
}

function assertRegularDirectory(path, label) {
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`${label} must be a real directory, not a symlink or special file.`);
  }
}

function isExcludedBuildPath(relativePath) {
  return BUILD_EXCLUSIONS.some(
    (excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`),
  );
}

function walkFiles(root, { excludeBuildEphemera = false } = {}) {
  assertRegularDirectory(root, root);
  const files = [];
  let totalBytes = 0;
  function visit(directory) {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      const relativePath = toPortablePath(relative(root, absolutePath));
      if (/[\u0000-\u001f\u007f\\]/u.test(relativePath)) {
        throw new Error(`Release inventory refuses unsafe path ${JSON.stringify(relativePath)}.`);
      }
      if (excludeBuildEphemera && isExcludedBuildPath(relativePath)) continue;
      if (entry.isSymbolicLink()) {
        throw new Error(`Release inventory refuses symbolic link ${absolutePath}.`);
      }
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Release inventory refuses special file ${absolutePath}.`);
      }
      const metadata = lstatSync(absolutePath);
      if (metadata.size > MAXIMUM_INVENTORY_FILE_BYTES) {
        throw new Error(`Release inventory file is above the reviewed size limit: ${relativePath}.`);
      }
      totalBytes += metadata.size;
      if (files.length + 1 > MAXIMUM_INVENTORY_FILES || totalBytes > MAXIMUM_INVENTORY_TOTAL_BYTES) {
        throw new Error("Release inventory exceeds its reviewed file-count or total-byte limit.");
      }
      const bytes = readFileSync(absolutePath);
      files.push({
        relativePath,
        bytes: bytes.length,
        sha256: sha256Bytes(bytes),
      });
    }
  }
  visit(root);
  return files.sort((left, right) =>
    left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0,
  );
}

export function packageFrontendBuild(buildDirectory, outputDirectory) {
  if (existsSync(outputDirectory)) {
    throw new Error("The sanitized frontend build output directory must not already exist.");
  }
  const files = walkFiles(buildDirectory, { excludeBuildEphemera: true });
  mkdirSync(outputDirectory, { recursive: false });
  for (const file of files) {
    const source = join(buildDirectory, file.relativePath);
    const destination = join(outputDirectory, file.relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    const copied = readFileSync(destination);
    if (copied.length !== file.bytes || sha256Bytes(copied) !== file.sha256) {
      throw new Error(`Sanitized build copy changed while packaging ${file.relativePath}.`);
    }
  }
  return summarizeFiles(files.map(({ relativePath, bytes, sha256 }) => ({
    path: `build/${relativePath}`,
    bytes,
    sha256,
  })));
}

function copyReviewedFileSet(sourceRoot, destinationRoot, destinationPrefix, seenPaths) {
  const copied = [];
  for (const file of walkFiles(sourceRoot)) {
    const destinationPath = destinationPrefix
      ? `${destinationPrefix}/${file.relativePath}`
      : file.relativePath;
    if (seenPaths.has(destinationPath)) {
      throw new Error(`Deployable frontend payload collision at ${destinationPath}.`);
    }
    seenPaths.add(destinationPath);
    const source = join(sourceRoot, file.relativePath);
    const destination = join(destinationRoot, destinationPath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    const copiedBytes = readFileSync(destination);
    if (copiedBytes.length !== file.bytes || sha256Bytes(copiedBytes) !== file.sha256) {
      throw new Error(`Deployable frontend packaging changed ${destinationPath}.`);
    }
    copied.push({ path: destinationPath, bytes: file.bytes, sha256: file.sha256 });
  }
  return copied;
}

export function packageFrontendDeployment(buildDirectory, publicDirectory, outputDirectory) {
  if (existsSync(outputDirectory)) {
    throw new Error("The deployable frontend output directory must not already exist.");
  }
  const standaloneDirectory = join(buildDirectory, "standalone");
  const staticDirectory = join(buildDirectory, "static");
  assertRegularDirectory(standaloneDirectory, "The Next.js standalone build");
  assertRegularDirectory(staticDirectory, "The Next.js static build");
  assertRegularDirectory(publicDirectory, "The frontend public directory");
  mkdirSync(outputDirectory, { recursive: false });
  const seenPaths = new Set();
  const files = [
    ...copyReviewedFileSet(standaloneDirectory, outputDirectory, "", seenPaths),
    ...copyReviewedFileSet(staticDirectory, outputDirectory, ".next/static", seenPaths),
    ...copyReviewedFileSet(publicDirectory, outputDirectory, "public", seenPaths),
  ].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  for (const requiredPath of ["server.js", "package.json", ".next/BUILD_ID"]) {
    if (!seenPaths.has(requiredPath)) {
      throw new Error(`The deployable standalone payload omits ${requiredPath}.`);
    }
  }
  return summarizeFiles(files);
}

function summarizeFiles(files) {
  return {
    sha256: sha256Canonical(files),
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  };
}

function publicUrlPath(relativePath) {
  return `/${relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function collectArtifactInventory(buildDirectory, publicDirectory, root) {
  const buildFiles = walkFiles(buildDirectory, { excludeBuildEphemera: true }).map((file) => ({
    path: `build/${file.relativePath}`,
    bytes: file.bytes,
    sha256: file.sha256,
  }));
  const publicFiles = walkFiles(publicDirectory).map((file) => ({
    path: `public/${file.relativePath}`,
    bytes: file.bytes,
    sha256: file.sha256,
  }));
  const appMetadataFiles = APP_METADATA_PUBLIC_ARTIFACTS
    .filter(({ sourcePath }) => existsSync(join(root, sourcePath)))
    .map(({ sourcePath, urlPath }) => {
      const absolutePath = join(root, sourcePath);
      const metadata = lstatSync(absolutePath);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new Error(`Frontend metadata asset ${sourcePath} must be a regular file.`);
      }
      const contents = readFileSync(absolutePath);
      return {
        path: `source/${sourcePath}`,
        urlPath,
        bytes: contents.length,
        sha256: sha256Bytes(contents),
      };
    });
  const artifactInventory = summarizeFiles([
    ...buildFiles,
    ...publicFiles,
    ...appMetadataFiles.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
  ].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const publicArtifacts = [];
  for (const file of buildFiles) {
    if (!file.path.startsWith("build/static/")) continue;
    const relativePath = file.path.slice("build/static/".length);
    publicArtifacts.push({
      sourcePath: file.path,
      urlPath: publicUrlPath(`_next/static/${relativePath}`),
      bytes: file.bytes,
      sha256: file.sha256,
    });
  }
  for (const file of publicFiles) {
    const relativePath = file.path.slice("public/".length);
    publicArtifacts.push({
      sourcePath: file.path,
      urlPath: publicUrlPath(relativePath),
      bytes: file.bytes,
      sha256: file.sha256,
    });
  }
  for (const file of appMetadataFiles) {
    publicArtifacts.push({
      sourcePath: file.path,
      urlPath: file.urlPath,
      bytes: file.bytes,
      sha256: file.sha256,
    });
  }
  publicArtifacts.sort((left, right) =>
    left.urlPath < right.urlPath ? -1 : left.urlPath > right.urlPath ? 1 : 0,
  );
  const seenUrlPaths = new Set();
  for (const file of publicArtifacts) {
    if (seenUrlPaths.has(file.urlPath)) {
      throw new Error(`Public release URL collision at ${file.urlPath}.`);
    }
    seenUrlPaths.add(file.urlPath);
  }
  if (!publicArtifacts.some((file) => file.urlPath.startsWith("/_next/static/"))) {
    throw new Error("The build has no public Next.js static artifacts.");
  }
  return { artifactInventory, publicArtifacts: summarizeFiles(publicArtifacts) };
}

export function validateReviewedEmbeddedOriginNoise(value) {
  assertExactKeys(
    value,
    ["schemaVersion", "sourceTreeSha256", "observations"],
    "Reviewed embedded-origin noise",
  );
  if (value.schemaVersion !== 2 || !Array.isArray(value.observations)) {
    throw new Error("Reviewed embedded-origin noise must use schemaVersion 2 with observations.");
  }
  assertHash(value.sourceTreeSha256, "Reviewed embedded-origin source-tree hash");
  const previousPaths = new Set();
  for (const observation of value.observations) {
    assertExactKeys(observation, ["path", "origins"], "Reviewed embedded-origin observation");
    if (
      typeof observation.path !== "string" ||
      !observation.path.startsWith("build/") ||
      observation.path.includes("..") ||
      /[\\\u0000-\u001f\u007f]/u.test(observation.path)
    ) throw new Error("Reviewed embedded-origin observation contains an unsafe path.");
    const markerCount = observation.path.split("{content-hash}").length - 1;
    if (
      markerCount > 1 ||
      (markerCount === 1 && (
        !observation.path.startsWith("build/static/") ||
        !STATIC_REVIEW_HASH_MARKER_PATH.test(observation.path)
      ))
    ) throw new Error("Reviewed embedded-origin observation contains an invalid hash marker.");
    if (
      !Array.isArray(observation.origins) ||
      observation.origins.length === 0 ||
      observation.origins.some((origin) => typeof origin !== "string" || origin.length === 0) ||
      canonicalJson(observation.origins) !== canonicalJson([...observation.origins].sort()) ||
      new Set(observation.origins).size !== observation.origins.length
    ) throw new Error(`Reviewed embedded origins for ${observation.path} must be sorted and unique.`);
    if (previousPaths.has(observation.path)) {
      throw new Error(`Reviewed embedded-origin path is duplicated: ${observation.path}.`);
    }
    previousPaths.add(observation.path);
  }
  const paths = value.observations.map(({ path }) => path);
  if (canonicalJson(paths) !== canonicalJson([...paths].sort())) {
    throw new Error("Reviewed embedded-origin observations must be sorted by exact artifact path.");
  }
  return value;
}

function embeddedOriginReviewPath(artifactPath) {
  if (!artifactPath.startsWith("build/static/")) return artifactPath;
  return artifactPath.replace(STATIC_CONTENT_HASH_PATH, "-{content-hash}$1");
}

function collectArtifactEmbeddedOrigins(buildDirectory, publicDirectory, policy, root, sourceTree) {
  const origins = new Set();
  const unexpected = [];
  const allowed = new Set([...policy.deploymentOrigins, ...policy.allowedArtifactEmbeddedOrigins]);
  const reviewedNoise = validateReviewedEmbeddedOriginNoise(
    readJson(join(root, EMBEDDED_ORIGIN_NOISE_PATH)),
  );
  const reviewedSourceFiles = sourceTree.files.filter(
    ({ path }) => path !== EMBEDDED_ORIGIN_NOISE_PATH,
  );
  const observedSourceTreeSha256 = sha256Canonical(reviewedSourceFiles);
  if (reviewedNoise.sourceTreeSha256 !== observedSourceTreeSha256) {
    throw new Error(
      "Reviewed embedded-origin observations do not match the exact tracked source tree.",
    );
  }
  const reviewedByPath = new Map(
    reviewedNoise.observations.map((observation) => [observation.path, observation]),
  );
  for (const root of [buildDirectory, publicDirectory]) {
    const rootLabel = root === buildDirectory ? "build" : "public";
    for (const file of walkFiles(root, { excludeBuildEphemera: root === buildDirectory })) {
      if (!EMBEDDED_ORIGIN_TEXT_EXTENSIONS.test(file.relativePath)) continue;
      const text = readFileSync(join(root, file.relativePath), "utf8");
      const artifactPath = `${rootLabel}/${file.relativePath}`;
      const reviewed = reviewedByPath.get(embeddedOriginReviewPath(artifactPath));
      for (const origin of observeEmbeddedNetworkOrigins(text)) {
        origins.add(origin);
        if (
          !allowed.has(origin) &&
          !reviewed?.origins.some((reviewedOrigin) => reviewedOrigin === origin)
        ) unexpected.push({ origin, path: artifactPath, sha256: file.sha256 });
      }
    }
  }
  for (const origin of policy.deploymentOrigins) origins.delete(origin);
  const observed = [...origins].sort();
  if (unexpected.length > 0) {
    const diagnostics = unexpected.slice(0, 30).map(
      ({ origin, path, sha256 }) => `${origin} in ${path} (sha256:${sha256})`,
    );
    throw new Error(
      `Built frontend artifacts embed unreviewed network origins: ${diagnostics.join("; ")}.`,
    );
  }
  return observed;
}

function collectSourceMaterials(root) {
  return SOURCE_MATERIAL_PATHS.map((relativePath) => {
    const bytes = readFileSync(join(root, relativePath));
    return { path: relativePath, bytes: bytes.length, sha256: sha256Bytes(bytes) };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function gitOutput(root, argumentsList, encoding = "utf8") {
  return execFileSync("git", argumentsList, {
    cwd: root,
    encoding,
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" },
    maxBuffer: 64 * 1024 * 1024,
  });
}

function collectTrackedSource(root, sourceCommit) {
  const head = gitOutput(root, ["rev-parse", "HEAD^{commit}"]).trim();
  if (head !== sourceCommit) {
    throw new Error(`Release source commit ${sourceCommit} does not match clean Git HEAD ${head}.`);
  }
  const status = gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status !== "") {
    throw new Error("Frontend release inventory requires a clean tracked and untracked Git checkout.");
  }
  const trackedPaths = gitOutput(root, ["ls-files", "-z"], "buffer")
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  if (trackedPaths.length === 0) throw new Error("Frontend release source tree has no tracked files.");
  const files = trackedPaths.map((path) => {
    const absolutePath = join(root, path);
    const metadata = lstatSync(absolutePath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`Frontend release source tree refuses tracked non-regular file ${path}.`);
    }
    const bytes = readFileSync(absolutePath);
    return { path: toPortablePath(path), bytes: bytes.length, sha256: sha256Bytes(bytes) };
  });
  return summarizeFiles(files);
}

export function deriveNoServerActionsBuildKey(sourceCommit) {
  if (!COMMIT_PATTERN.test(sourceCommit ?? "")) {
    throw new Error("The no-server-actions build key requires a lowercase 40-character source commit.");
  }
  const digest = sha256Bytes(`${NO_SERVER_ACTIONS_BUILD_KEY_DOMAIN}${sourceCommit}`);
  return Buffer.from(digest, "hex").toString("base64");
}

function readRegularNonSymlinkFile(path, label) {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(descriptor).isFile()) {
      throw new Error("not a regular file");
    }
    return readFileSync(descriptor);
  } catch {
    throw new Error(`${label} cannot be opened as a regular non-symlink file: ${path}.`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readRegularJson(path, label) {
  const contents = readRegularNonSymlinkFile(path, label);
  let manifest;
  try {
    manifest = JSON.parse(contents);
  } catch {
    throw new Error(`${label} is not valid JSON: ${path}.`);
  }
  return { contents, manifest };
}

function writeCanonicalJsonThroughDescriptor(path, value, label) {
  const bytes = Buffer.from(canonicalJson(value));
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDWR | constants.O_NOFOLLOW);
    if (!fstatSync(descriptor).isFile()) throw new Error("not a regular file");
    ftruncateSync(descriptor, 0);
    const written = writeSync(descriptor, bytes, 0, bytes.length, 0);
    if (written !== bytes.length) throw new Error("short write");
  } catch {
    throw new Error(`${label} cannot be rewritten through a regular non-symlink file descriptor: ${path}.`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function assertSourceCommit(sourceCommit, label) {
  if (!COMMIT_PATTERN.test(sourceCommit ?? "")) {
    throw new Error(`${label} requires a lowercase 40-character source commit.`);
  }
}

export function deriveDisabledPreviewModeProperties(sourceCommit) {
  assertSourceCommit(sourceCommit, "Disabled preview-mode properties");
  const derive = (purpose) => sha256Bytes(
    `${DISABLED_PREVIEW_BUILD_KEY_DOMAIN}${purpose}\0${sourceCommit}`,
  );
  return {
    previewModeId: derive("id").slice(0, 32),
    previewModeSigningKey: derive("signing"),
    previewModeEncryptionKey: derive("encryption"),
  };
}

function validatePreviewManifest(manifest, path, { requireDeterministic, sourceCommit }) {
  assertExactKeys(
    manifest,
    ["version", "routes", "dynamicRoutes", "notFoundRoutes", "preview"],
    `Prerender manifest ${path}`,
  );
  assertExactKeys(
    manifest.preview,
    ["previewModeId", "previewModeSigningKey", "previewModeEncryptionKey"],
    `Prerender preview properties ${path}`,
  );
  const shapes = {
    previewModeId: /^[0-9a-f]{32}$/u,
    previewModeSigningKey: /^[0-9a-f]{64}$/u,
    previewModeEncryptionKey: /^[0-9a-f]{64}$/u,
  };
  for (const [name, pattern] of Object.entries(shapes)) {
    if (!pattern.test(manifest.preview[name] ?? "")) {
      throw new Error(`Prerender preview property ${name} is malformed in ${path}.`);
    }
  }
  if (
    requireDeterministic &&
    canonicalJson(manifest.preview) !== canonicalJson(deriveDisabledPreviewModeProperties(sourceCommit))
  ) throw new Error(`Disabled preview properties are not bound to the reviewed source commit in ${path}.`);
}

function validateRouteMapManifest(manifest, path) {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    Object.values(manifest).some((value) => typeof value !== "string")
  ) throw new Error(`Route-map manifest ${path} must contain only string path mappings.`);
}

function validateNormalizedBuildManifest(relativePath, manifest, path, options) {
  if (relativePath === "prerender-manifest.json") {
    validatePreviewManifest(manifest, path, options);
  } else {
    validateRouteMapManifest(manifest, path);
  }
}

export function normalizeFrontendBuild(buildDirectory, sourceCommit) {
  assertSourceCommit(sourceCommit, "Frontend build normalization");
  for (const relativePath of NORMALIZED_BUILD_MANIFEST_PATHS) {
    const paths = [
      join(buildDirectory, relativePath),
      join(buildDirectory, "standalone", ".next", relativePath),
    ];
    const parsed = paths.map((path) => {
      const { manifest } = readRegularJson(path, "Next.js generated build manifest");
      validateNormalizedBuildManifest(relativePath, manifest, path, {
        requireDeterministic: false,
        sourceCommit,
      });
      return manifest;
    });
    if (canonicalJson(parsed[0]) !== canonicalJson(parsed[1])) {
      throw new Error(`Next.js root and standalone manifests disagree before normalization: ${relativePath}.`);
    }
    if (relativePath === "prerender-manifest.json") {
      parsed[0].preview = deriveDisabledPreviewModeProperties(sourceCommit);
      parsed[1].preview = deriveDisabledPreviewModeProperties(sourceCommit);
    }
    for (let index = 0; index < paths.length; index += 1) {
      writeCanonicalJsonThroughDescriptor(
        paths[index],
        parsed[index],
        "Next.js generated build manifest",
      );
    }
  }
}

function assertNormalizedFrontendBuild(buildDirectory, sourceCommit) {
  for (const relativePath of NORMALIZED_BUILD_MANIFEST_PATHS) {
    const paths = [
      join(buildDirectory, relativePath),
      join(buildDirectory, "standalone", ".next", relativePath),
    ];
    const parsed = paths.map((path) => {
      const { contents, manifest } = readRegularJson(path, "Next.js normalized build manifest");
      validateNormalizedBuildManifest(relativePath, manifest, path, {
        requireDeterministic: true,
        sourceCommit,
      });
      if (!contents.equals(Buffer.from(canonicalJson(manifest)))) {
        throw new Error(`Next.js build manifest is not in canonical byte form: ${path}.`);
      }
      return manifest;
    });
    if (canonicalJson(parsed[0]) !== canonicalJson(parsed[1])) {
      throw new Error(`Next.js normalized root and standalone manifests disagree: ${relativePath}.`);
    }
  }
}

function readServerReferenceManifest(path, sourceCommit) {
  const { manifest } = readRegularJson(path, "The Next.js server-reference manifest");
  assertExactKeys(manifest, ["node", "edge", "encryptionKey"], `Server-reference manifest ${path}`);
  for (const runtime of ["node", "edge"]) {
    const entries = manifest[runtime];
    if (!entries || typeof entries !== "object" || Array.isArray(entries) || Object.keys(entries).length !== 0) {
      throw new Error(`The Next.js ${runtime} server-action map must be empty in ${path}.`);
    }
  }
  if (manifest.encryptionKey !== deriveNoServerActionsBuildKey(sourceCommit)) {
    throw new Error(`The Next.js no-server-actions build key is not bound to the reviewed source commit in ${path}.`);
  }
}

function assertNoServerActions(root, sourceTree, buildDirectory, sourceCommit) {
  const sourcePattern = /^src\/.*\.(?:js|jsx|mjs|ts|tsx)$/u;
  // Deliberately reject the directive string anywhere in executable source.
  // This is broader than JavaScript directive-prologue parsing, so comments or
  // unusual whitespace cannot turn a missed server action into a release gap.
  const serverDirective = /["']use[\t ]+server["']/u;
  const serverActionSources = sourceTree.files
    .filter(({ path }) => sourcePattern.test(path))
    .filter(({ path }) => serverDirective.test(readFileSync(join(root, path), "utf8")))
    .map(({ path }) => path);
  if (serverActionSources.length > 0) {
    throw new Error(
      `Frontend release contains unsupported Next server actions: ${serverActionSources.join(", ")}.`,
    );
  }
  const previewSourcePattern = /\b(?:draftMode|setPreviewData|clearPreviewData|previewData)\b/u;
  const previewSources = sourceTree.files
    .filter(({ path }) => sourcePattern.test(path))
    .filter(({ path }) => previewSourcePattern.test(readFileSync(join(root, path), "utf8")))
    .map(({ path }) => path);
  if (previewSources.length > 0) {
    throw new Error(
      `Frontend release contains unsupported preview or draft-mode APIs: ${previewSources.join(", ")}.`,
    );
  }
  readServerReferenceManifest(join(buildDirectory, "server", "server-reference-manifest.json"), sourceCommit);
  readServerReferenceManifest(
    join(buildDirectory, "standalone", ".next", "server", "server-reference-manifest.json"),
    sourceCommit,
  );
}

function readBuildId(buildDirectory, sourceCommit) {
  const buildIdPath = join(buildDirectory, "BUILD_ID");
  const metadata = lstatSync(buildIdPath);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error("The Next.js build omits a regular BUILD_ID file.");
  }
  const buildId = readFileSync(buildIdPath, "utf8").trim();
  if (buildId !== sourceCommit) {
    throw new Error(`Next.js BUILD_ID is ${JSON.stringify(buildId)}; expected source commit ${sourceCommit}.`);
  }
  return buildId;
}

export function createFrontendArtifactInventory({
  root = repositoryRoot,
  buildDirectory = join(root, ".next"),
  publicDirectory = join(root, "public"),
  policyPath = join(root, "src/config/frontendReleasePolicy.json"),
  sourceCommit,
  builderImage,
} = {}) {
  if (!COMMIT_PATTERN.test(sourceCommit ?? "")) {
    throw new Error("The frontend inventory requires a lowercase 40-character source commit.");
  }
  if (builderImage !== REVIEWED_FRONTEND_BUILDER_IMAGE) {
    throw new Error("The frontend inventory requires the reviewed digest-pinned x64 Node builder image.");
  }
  const policy = validateFrontendReleasePolicy(readJson(policyPath));
  const buildId = readBuildId(buildDirectory, sourceCommit);
  const { artifactInventory, publicArtifacts } = collectArtifactInventory(
    buildDirectory,
    publicDirectory,
    root,
  );
  const sourceTree = collectTrackedSource(root, sourceCommit);
  validateRouteSourceCoverageAgainstSources(
    policy,
    sourceTree.files.map(({ path }) => path),
  );
  assertNoServerActions(root, sourceTree, buildDirectory, sourceCommit);
  assertNormalizedFrontendBuild(buildDirectory, sourceCommit);
  const inventory = {
    kind: "lester-labs-frontend-artifact-inventory",
    schemaVersion: 1,
    sourceCommit,
    buildId,
    builderImage,
    policySha256: sha256Canonical(policy),
    sourceMaterials: collectSourceMaterials(root),
    sourceTree,
    artifactEmbeddedOrigins: collectArtifactEmbeddedOrigins(
      buildDirectory,
      publicDirectory,
      policy,
      root,
      sourceTree,
    ),
    artifactInventory,
    publicArtifacts,
  };
  validateFrontendArtifactInventory(inventory);
  return inventory;
}

function validateFileList(files, expectedKeys, label, pathKey) {
  if (!Array.isArray(files) || files.length === 0) throw new Error(`${label} must not be empty.`);
  let previousPath = "";
  const seen = new Set();
  for (const file of files) {
    assertExactKeys(file, expectedKeys, `${label} entry`);
    const currentPath = file[pathKey];
    if (typeof currentPath !== "string" || currentPath.length === 0 || currentPath.includes("..")) {
      throw new Error(`${label} contains an unsafe path.`);
    }
    if (previousPath && currentPath <= previousPath) {
      throw new Error(`${label} paths must be unique and sorted.`);
    }
    if (seen.has(currentPath)) throw new Error(`${label} paths must be unique.`);
    seen.add(currentPath);
    previousPath = currentPath;
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new Error(`${label} contains an invalid byte length.`);
    }
    assertHash(file.sha256, `${label} file digest`);
  }
}

function validateInventorySummary(value, expectedKeys, label, pathKey) {
  assertExactKeys(value, INVENTORY_KEYS, label);
  assertHash(value.sha256, `${label} root digest`);
  validateFileList(value.files, expectedKeys, `${label} files`, pathKey);
  const expectedDigest = sha256Canonical(value.files);
  const expectedBytes = value.files.reduce((total, file) => total + file.bytes, 0);
  if (
    value.sha256 !== expectedDigest ||
    value.fileCount !== value.files.length ||
    value.totalBytes !== expectedBytes
  ) {
    throw new Error(`${label} summary does not match its file records.`);
  }
}

function validateSourceMaterials(value) {
  validateFileList(value, FILE_KEYS, "Source materials", "path");
  const expectedPaths = [...SOURCE_MATERIAL_PATHS].sort();
  const actualPaths = value.map(({ path }) => path);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error("Source materials must contain exactly the reviewed release-control paths.");
  }
}

export function validateFrontendArtifactInventory(value) {
  assertExactKeys(
    value,
    [
      "kind",
      "schemaVersion",
      "sourceCommit",
      "buildId",
      "builderImage",
      "policySha256",
      "sourceMaterials",
      "sourceTree",
      "artifactEmbeddedOrigins",
      "artifactInventory",
      "publicArtifacts",
    ],
    "The frontend artifact inventory",
  );
  if (value.kind !== "lester-labs-frontend-artifact-inventory" || value.schemaVersion !== 1) {
    throw new Error("The frontend artifact inventory kind or schema version is unsupported.");
  }
  if (!COMMIT_PATTERN.test(value.sourceCommit) || value.buildId !== value.sourceCommit) {
    throw new Error("The frontend artifact inventory is not bound to one valid source commit.");
  }
  if (value.builderImage !== REVIEWED_FRONTEND_BUILDER_IMAGE) {
    throw new Error("The frontend artifact inventory names an unreviewed builder image.");
  }
  assertHash(value.policySha256, "Frontend policy digest");
  validateSourceMaterials(value.sourceMaterials);
  validateInventorySummary(value.sourceTree, FILE_KEYS, "Tracked source tree", "path");
  if (
    !Array.isArray(value.artifactEmbeddedOrigins) ||
    value.artifactEmbeddedOrigins.some((origin) => typeof origin !== "string") ||
    canonicalJson(value.artifactEmbeddedOrigins) !== canonicalJson([...value.artifactEmbeddedOrigins].sort()) ||
    new Set(value.artifactEmbeddedOrigins).size !== value.artifactEmbeddedOrigins.length
  ) throw new Error("Embedded artifact origins must be a sorted unique string array.");
  validateInventorySummary(value.artifactInventory, FILE_KEYS, "Build artifact inventory", "path");
  validateInventorySummary(value.publicArtifacts, PUBLIC_FILE_KEYS, "Public artifact inventory", "urlPath");
  for (const file of value.publicArtifacts.files) {
    if (!file.urlPath.startsWith("/") || file.urlPath.startsWith("//")) {
      throw new Error("A public artifact has an unsafe URL path.");
    }
    if (!value.artifactInventory.files.some(
      (artifact) => artifact.path === file.sourcePath && artifact.sha256 === file.sha256,
    )) {
      throw new Error(`Public artifact ${file.urlPath} is not bound to the build inventory.`);
    }
  }
  return value;
}

export function compareFrontendArtifactInventories(left, right) {
  validateFrontendArtifactInventory(left);
  validateFrontendArtifactInventory(right);
  if (canonicalJson(left) !== canonicalJson(right)) {
    const leftFiles = new Map(left.artifactInventory.files.map((file) => [file.path, file]));
    const rightFiles = new Map(right.artifactInventory.files.map((file) => [file.path, file]));
    const differences = [...new Set([...leftFiles.keys(), ...rightFiles.keys()])]
      .sort()
      .filter((path) => JSON.stringify(leftFiles.get(path)) !== JSON.stringify(rightFiles.get(path)));
    throw new Error(
      `Repeated frontend builds differ${differences.length ? ` at ${differences.slice(0, 20).join(", ")}` : " in release metadata"}.`,
    );
  }
  return {
    reproducible: true,
    sourceCommit: left.sourceCommit,
    artifactInventorySha256: left.artifactInventory.sha256,
    publicArtifactsSha256: left.publicArtifacts.sha256,
    fileCount: left.artifactInventory.fileCount,
  };
}

export function compareFileInventories(left, right) {
  validateInventorySummary(left, FILE_KEYS, "First file inventory", "path");
  validateInventorySummary(right, FILE_KEYS, "Second file inventory", "path");
  if (canonicalJson(left) !== canonicalJson(right)) {
    const leftFiles = new Map(left.files.map((file) => [file.path, file]));
    const rightFiles = new Map(right.files.map((file) => [file.path, file]));
    const differences = [...new Set([...leftFiles.keys(), ...rightFiles.keys()])]
      .sort()
      .filter((path) => JSON.stringify(leftFiles.get(path)) !== JSON.stringify(rightFiles.get(path)));
    throw new Error(
      `Repeated deployable payloads differ${differences.length ? ` at ${differences.slice(0, 20).join(", ")}` : " in inventory metadata"}.`,
    );
  }
  return {
    reproducible: true,
    sha256: left.sha256,
    fileCount: left.fileCount,
    totalBytes: left.totalBytes,
  };
}

function assertLoopbackOrigin(rawOrigin) {
  const origin = new URL(rawOrigin);
  if (
    origin.protocol !== "http:" ||
    !["127.0.0.1", "[::1]", "localhost", "release-server"].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("Local route capture accepts only the reviewed credential-free isolated builder origin.");
  }
  return origin.origin;
}

export async function captureFrontendRouteResponses(
  localOrigin,
  policyValue,
  fetchImpl = globalThis.fetch,
) {
  const policy = validateFrontendReleasePolicy(policyValue);
  const origin = assertLoopbackOrigin(localOrigin);
  const allowedOrigins = new Set([origin]);
  const routes = [];
  for (const path of policy.routes) {
    const response = await fetchBounded(new URL(path, origin).href, {
      allowedOrigins,
      maximumResponseBytes: policy.maximumResponseBytes,
      fetchImpl,
      attempts: 60,
      retryDelayMs: 250,
    });
    const body = response.bytes.toString("utf8");
    const observation = observeResponseBody(body, response.finalUrl, response.headers, policy);
    const verifiedHeaders = verifyResponsePolicy(response.headers, observation, policy);
    const capturedHeaders = {
      "content-type": response.headers["content-type"] ?? "",
      ...headersForPolicy(verifiedHeaders, policy),
    };
    routes.push({
      path,
      finalPath: new URL(response.finalUrl).pathname,
      status: response.status,
      headers: capturedHeaders,
      bodyBase64: response.bytes.toString("base64"),
    });
  }
  return {
    kind: "lester-labs-raw-frontend-route-capture",
    schemaVersion: 1,
    policySha256: sha256Canonical(policy),
    routes,
  };
}

function routeSnapshotsFromCapture(capture, policy, publicArtifacts) {
  assertExactKeys(
    capture,
    ["kind", "schemaVersion", "policySha256", "routes"],
    "The raw frontend route capture",
  );
  if (capture.kind !== "lester-labs-raw-frontend-route-capture" || capture.schemaVersion !== 1) {
    throw new Error("The raw frontend route capture kind or schema version is unsupported.");
  }
  if (capture.policySha256 !== sha256Canonical(policy)) {
    throw new Error("The raw frontend route capture is bound to a different policy.");
  }
  if (!Array.isArray(capture.routes) || capture.routes.length !== policy.routes.length) {
    throw new Error("The raw frontend route capture omits reviewed critical routes.");
  }
  const publicPaths = new Set(publicArtifacts.files.map((file) => file.urlPath));
  const snapshots = [];
  for (let index = 0; index < capture.routes.length; index += 1) {
    const route = capture.routes[index];
    assertExactKeys(
      route,
      ["path", "finalPath", "status", "headers", "bodyBase64"],
      "A raw frontend route capture",
    );
    if (route.path !== policy.routes[index] || route.status !== 200) {
      throw new Error("The raw frontend route capture path/order/status differs from policy.");
    }
    if (
      typeof route.finalPath !== "string" ||
      !route.finalPath.startsWith("/") ||
      typeof route.bodyBase64 !== "string"
    ) throw new Error("A raw frontend route capture has invalid scalar fields.");
    const expectedHeaderNames = ["content-type", ...Object.keys(policy.criticalResponseHeaders)].sort();
    assertExactKeys(route.headers, expectedHeaderNames, "Raw frontend route headers");
    const bytes = Buffer.from(route.bodyBase64, "base64");
    if (bytes.toString("base64") !== route.bodyBase64 || bytes.length > policy.maximumResponseBytes) {
      throw new Error("A raw frontend route capture body is malformed or above the reviewed limit.");
    }
    const body = bytes.toString("utf8");
    const observation = observeResponseBody(body, `http://127.0.0.1${route.finalPath}`, route.headers, policy);
    const securityHeaders = verifyResponsePolicy(route.headers, observation, policy);
    for (const resourcePath of observation.referencedActiveResourcePaths) {
      if (!publicPaths.has(resourcePath)) {
        throw new Error(`Local route ${route.path} references an active resource absent from the inventory: ${resourcePath}.`);
      }
    }
    snapshots.push({
      path: route.path,
      finalPath: route.finalPath,
      bodySha256: sha256Bytes(bytes),
      bytes: bytes.length,
      contentType: route.headers["content-type"],
      securityHeaders: headersForPolicy(securityHeaders, policy),
      thirdPartyOrigins: observation.thirdPartyOrigins,
      activeResourceOrigins: observation.activeResourceOrigins,
      referencedActiveResourcePaths: observation.referencedActiveResourcePaths,
    });
  }
  return snapshots;
}

function reviewedNpmVersion(root) {
  const packageManager = readJson(join(root, "package.json"))?.packageManager;
  if (packageManager !== "npm@11.16.0") {
    throw new Error("The release source must pin the exact reviewed npm@11.16.0 package manager.");
  }
  return packageManager.slice("npm@".length);
}

function sbomRecord(sbomPath) {
  const bytes = readFileSync(sbomPath);
  const parsed = JSON.parse(bytes.toString("utf8"));
  if (parsed.bomFormat !== "CycloneDX" || typeof parsed.specVersion !== "string") {
    throw new Error("The release SBOM must be npm-generated CycloneDX JSON.");
  }
  return {
    format: parsed.bomFormat,
    specVersion: parsed.specVersion,
    bytes: bytes.length,
    sha256: sha256Bytes(bytes),
  };
}

function deploymentArtifactRecord(archivePath, payloadInventoryPath) {
  const metadata = lstatSync(archivePath);
  if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.size <= 0) {
    throw new Error("The deployable frontend archive must be a non-empty regular file.");
  }
  if (metadata.size > MAXIMUM_INVENTORY_TOTAL_BYTES) {
    throw new Error("The deployable frontend archive exceeds the reviewed size limit.");
  }
  const payloadInventory = readJson(payloadInventoryPath);
  validateInventorySummary(payloadInventory, FILE_KEYS, "Deployable payload inventory", "path");
  const archiveBytes = readFileSync(archivePath);
  return {
    format: "application/vnd.lester-labs.next-standalone.tar",
    archiveBytes: archiveBytes.length,
    archiveSha256: sha256Bytes(archiveBytes),
    payloadInventorySha256: payloadInventory.sha256,
    fileCount: payloadInventory.fileCount,
    totalBytes: payloadInventory.totalBytes,
  };
}

export async function createFrontendReleaseAttestation({
  root = repositoryRoot,
  buildDirectory = join(root, ".next"),
  publicDirectory = join(root, "public"),
  policyPath = join(root, "src/config/frontendReleasePolicy.json"),
  sbomPath,
  sourceCommit,
  builderImage,
  localOrigin,
  routeCapturePath,
  deploymentArtifactPath,
  deploymentInventoryPath,
  releaseProfile,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!sbomPath) throw new Error("A CycloneDX SBOM path is required.");
  if (!deploymentArtifactPath || !deploymentInventoryPath) {
    throw new Error("A reproducible deployable archive and payload inventory are required.");
  }
  if ((localOrigin ? 1 : 0) + (routeCapturePath ? 1 : 0) !== 1) {
    throw new Error("Exactly one loopback server or raw route-capture path is required.");
  }
  assertReleaseProfile(releaseProfile, "Frontend release profile");
  const policy = validateFrontendReleasePolicy(readJson(policyPath));
  const inventory = createFrontendArtifactInventory({
    root,
    buildDirectory,
    publicDirectory,
    policyPath,
    sourceCommit,
    builderImage,
  });
  const capture = routeCapturePath
    ? readJson(routeCapturePath)
    : await captureFrontendRouteResponses(localOrigin, policy, fetchImpl);
  const routeSnapshots = routeSnapshotsFromCapture(capture, policy, inventory.publicArtifacts);
  const base = {
    kind: "lester-labs-frontend-release-attestation",
    schemaVersion: 1,
    releaseProfile,
    sourceCommit,
    buildId: inventory.buildId,
    builderImage: inventory.builderImage,
    runtime: {
      node: process.version,
      npm: reviewedNpmVersion(root),
      os: process.platform,
      arch: process.arch,
    },
    policySha256: inventory.policySha256,
    sourceMaterials: inventory.sourceMaterials,
    sourceTree: inventory.sourceTree,
    artifactEmbeddedOrigins: inventory.artifactEmbeddedOrigins,
    sbom: sbomRecord(sbomPath),
    deploymentArtifact: deploymentArtifactRecord(
      deploymentArtifactPath,
      deploymentInventoryPath,
    ),
    artifactInventory: inventory.artifactInventory,
    publicArtifacts: inventory.publicArtifacts,
    routeSnapshots,
  };
  const value = {
    status: "CANDIDATE",
    ...base,
    reviewPayloadSha256: sha256Canonical(base),
    approvalEnvelopes: [],
  };
  validateFrontendReleaseAttestation(value);
  return value;
}

function validateRouteSnapshots(routeSnapshots) {
  if (!Array.isArray(routeSnapshots) || routeSnapshots.length === 0) {
    throw new Error("Frontend release attestation must include critical-route snapshots.");
  }
  for (const snapshot of routeSnapshots) {
    assertExactKeys(
      snapshot,
      [
        "path",
        "finalPath",
        "bodySha256",
        "bytes",
        "contentType",
        "securityHeaders",
        "thirdPartyOrigins",
        "activeResourceOrigins",
        "referencedActiveResourcePaths",
      ],
      "A route snapshot",
    );
    if (
      typeof snapshot.path !== "string" ||
      typeof snapshot.finalPath !== "string" ||
      !Number.isSafeInteger(snapshot.bytes) ||
      snapshot.bytes < 0 ||
      typeof snapshot.contentType !== "string"
    ) throw new Error("A route snapshot contains invalid scalar metadata.");
    assertHash(snapshot.bodySha256, "Route body digest");
    if (!snapshot.securityHeaders || typeof snapshot.securityHeaders !== "object") {
      throw new Error("A route snapshot omits security headers.");
    }
    for (const field of ["thirdPartyOrigins", "activeResourceOrigins", "referencedActiveResourcePaths"]) {
      if (
        !Array.isArray(snapshot[field]) ||
        snapshot[field].some((entry) => typeof entry !== "string") ||
        JSON.stringify(snapshot[field]) !== JSON.stringify([...snapshot[field]].sort()) ||
        new Set(snapshot[field]).size !== snapshot[field].length
      ) throw new Error(`Route snapshot ${field} must be a sorted unique string array.`);
    }
  }
}

function reviewPayloadFromAttestation(value) {
  const payload = { ...value };
  delete payload.status;
  delete payload.reviewPayloadSha256;
  delete payload.approvalEnvelopes;
  return payload;
}

function validateApprovalEnvelopeReferences(value) {
  if (!Array.isArray(value.approvalEnvelopes)) {
    throw new Error("Frontend release approvalEnvelopes must be an array.");
  }
  if (value.status === "CANDIDATE") {
    if (value.approvalEnvelopes.length !== 0) {
      throw new Error("A CANDIDATE frontend release must not contain approval envelopes.");
    }
    return;
  }
  if (value.approvalEnvelopes.length !== 2) {
    throw new Error("An APPROVED frontend release requires exactly two protected approval envelopes.");
  }
  const roles = new Set();
  const environments = new Set();
  const rawDigests = new Set();
  const provenanceDigests = new Set();
  for (const approval of value.approvalEnvelopes) {
    assertExactKeys(
      approval,
      ["reviewRole", "protectedEnvironment", "rawSha256", "provenanceSha256"],
      "A frontend protected approval reference",
    );
    if (!REVIEW_ROLES.includes(approval.reviewRole)) {
      throw new Error("A frontend protected approval has an unsupported review role.");
    }
    if (approval.protectedEnvironment !== APPROVAL_ENVIRONMENTS[approval.reviewRole]) {
      throw new Error("A frontend protected approval names the wrong role-specific environment.");
    }
    assertHash(approval.rawSha256, "Frontend approval-envelope digest");
    assertHash(approval.provenanceSha256, "Frontend approval provenance digest");
    if (approval.rawSha256 === "0".repeat(64) || approval.provenanceSha256 === "0".repeat(64)) {
      throw new Error("Frontend approval evidence digests must not be the zero digest.");
    }
    roles.add(approval.reviewRole);
    environments.add(approval.protectedEnvironment);
    rawDigests.add(approval.rawSha256);
    provenanceDigests.add(approval.provenanceSha256);
  }
  if (roles.size !== 2 || environments.size !== 2 || rawDigests.size !== 2 || provenanceDigests.size !== 2) {
    throw new Error("Frontend approval requires distinct role-specific protected evidence envelopes.");
  }
}

export function validateFrontendReleaseAttestation(
  value,
  { requireApproved = false, requireReleaseRuntime = false } = {},
) {
  assertExactKeys(
    value,
    [
      "status",
      "kind",
      "schemaVersion",
      "releaseProfile",
      "sourceCommit",
      "buildId",
      "builderImage",
      "runtime",
      "policySha256",
      "sourceMaterials",
      "sourceTree",
      "artifactEmbeddedOrigins",
      "sbom",
      "deploymentArtifact",
      "artifactInventory",
      "publicArtifacts",
      "routeSnapshots",
      "reviewPayloadSha256",
      "approvalEnvelopes",
    ],
    "The frontend release attestation",
  );
  if (value.status !== "CANDIDATE" && value.status !== "APPROVED") {
    throw new Error("Frontend release attestation status must be CANDIDATE or APPROVED.");
  }
  if (requireApproved && value.status !== "APPROVED") {
    throw new Error("Served-artifact parity requires a reviewed APPROVED frontend manifest.");
  }
  if (value.kind !== "lester-labs-frontend-release-attestation" || value.schemaVersion !== 1) {
    throw new Error("The frontend release attestation kind or schema version is unsupported.");
  }
  assertReleaseProfile(value.releaseProfile, "Frontend release profile");
  if (!COMMIT_PATTERN.test(value.sourceCommit) || value.buildId !== value.sourceCommit) {
    throw new Error("The frontend release attestation is not bound to one valid source commit.");
  }
  if (value.builderImage !== REVIEWED_FRONTEND_BUILDER_IMAGE) {
    throw new Error("The frontend release attestation names an unreviewed builder image.");
  }
  assertExactKeys(value.runtime, ["node", "npm", "os", "arch"], "Frontend release runtime");
  if (Object.values(value.runtime).some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error("Frontend release runtime fields must be non-empty strings.");
  }
  if (
    requireReleaseRuntime &&
    (value.runtime.node !== "v24.18.0" ||
      value.runtime.npm !== "11.16.0" ||
      value.runtime.os !== "linux" ||
      value.runtime.arch !== "x64")
  ) throw new Error("The approved frontend was not built with the reviewed x64 Linux Node/npm runtime.");
  assertHash(value.policySha256, "Frontend policy digest");
  validateSourceMaterials(value.sourceMaterials);
  validateInventorySummary(value.sourceTree, FILE_KEYS, "Tracked source tree", "path");
  if (
    !Array.isArray(value.artifactEmbeddedOrigins) ||
    value.artifactEmbeddedOrigins.some((origin) => typeof origin !== "string") ||
    canonicalJson(value.artifactEmbeddedOrigins) !== canonicalJson([...value.artifactEmbeddedOrigins].sort()) ||
    new Set(value.artifactEmbeddedOrigins).size !== value.artifactEmbeddedOrigins.length
  ) throw new Error("Frontend embedded artifact origins must be a sorted unique string array.");
  assertExactKeys(value.sbom, ["format", "specVersion", "bytes", "sha256"], "Frontend SBOM");
  if (
    value.sbom.format !== "CycloneDX" ||
    typeof value.sbom.specVersion !== "string" ||
    !Number.isSafeInteger(value.sbom.bytes) ||
    value.sbom.bytes <= 0
  ) throw new Error("Frontend SBOM metadata is invalid.");
  assertHash(value.sbom.sha256, "Frontend SBOM digest");
  assertExactKeys(
    value.deploymentArtifact,
    ["format", "archiveBytes", "archiveSha256", "payloadInventorySha256", "fileCount", "totalBytes"],
    "Deployable frontend artifact",
  );
  if (
    value.deploymentArtifact.format !== "application/vnd.lester-labs.next-standalone.tar" ||
    !Number.isSafeInteger(value.deploymentArtifact.archiveBytes) ||
    value.deploymentArtifact.archiveBytes <= 0 ||
    !Number.isSafeInteger(value.deploymentArtifact.fileCount) ||
    value.deploymentArtifact.fileCount <= 0 ||
    !Number.isSafeInteger(value.deploymentArtifact.totalBytes) ||
    value.deploymentArtifact.totalBytes <= 0
  ) throw new Error("Deployable frontend artifact metadata is invalid.");
  assertHash(value.deploymentArtifact.archiveSha256, "Deployable frontend archive digest");
  assertHash(value.deploymentArtifact.payloadInventorySha256, "Deployable payload inventory digest");
  validateInventorySummary(value.artifactInventory, FILE_KEYS, "Build artifact inventory", "path");
  validateInventorySummary(value.publicArtifacts, PUBLIC_FILE_KEYS, "Public artifact inventory", "urlPath");
  validateRouteSnapshots(value.routeSnapshots);
  assertHash(value.reviewPayloadSha256, "Frontend review payload digest");
  const expectedReviewDigest = sha256Canonical(reviewPayloadFromAttestation(value));
  if (value.reviewPayloadSha256 !== expectedReviewDigest) {
    throw new Error("The frontend release review payload digest does not match the manifest.");
  }
  validateApprovalEnvelopeReferences(value);
  const publicPaths = new Set(value.publicArtifacts.files.map((file) => file.urlPath));
  for (const snapshot of value.routeSnapshots) {
    for (const path of snapshot.referencedActiveResourcePaths) {
      if (!publicPaths.has(path)) throw new Error(`Reviewed route references uninventoried active resource ${path}.`);
    }
  }
  return value;
}

export function validateFrontendApprovalEnvelope(value, candidate) {
  assertExactKeys(
    value,
    [
      "kind",
      "schemaVersion",
      "sourceCommit",
      "reviewPayloadSha256",
      "candidateSha256",
      "candidateProvenanceSha256",
      "reviewRole",
      "protectedEnvironment",
      "repository",
      "ref",
      "workflowPath",
      "workflowRunId",
      "workflowRunAttempt",
      "requestedBy",
      "createdAt",
    ],
    "The protected frontend approval envelope",
  );
  if (value.kind !== "lester-labs-protected-frontend-approval" || value.schemaVersion !== 1) {
    throw new Error("The protected frontend approval envelope kind or schema is unsupported.");
  }
  if (!candidate || candidate.status !== "CANDIDATE") {
    throw new Error("A protected frontend approval must bind the exact CANDIDATE manifest.");
  }
  validateFrontendReleaseAttestation(candidate);
  if (
    value.sourceCommit !== candidate.sourceCommit ||
    value.reviewPayloadSha256 !== candidate.reviewPayloadSha256 ||
    value.candidateSha256 !== sha256Bytes(canonicalJson(candidate))
  ) throw new Error("The protected frontend approval is bound to another candidate.");
  assertHash(value.candidateSha256, "Frontend candidate digest");
  assertHash(value.candidateProvenanceSha256, "Frontend candidate provenance digest");
  if (!REVIEW_ROLES.includes(value.reviewRole)) {
    throw new Error("The protected frontend approval role is unsupported.");
  }
  if (value.protectedEnvironment !== APPROVAL_ENVIRONMENTS[value.reviewRole]) {
    throw new Error("The protected frontend approval used the wrong role-specific environment.");
  }
  if (
    value.repository !== APPROVAL_REPOSITORY ||
    value.ref !== "refs/heads/main" ||
    value.workflowPath !== APPROVAL_WORKFLOW_PATH
  ) throw new Error("The protected frontend approval has an unreviewed GitHub workflow identity.");
  if (typeof value.workflowRunId !== "string" || !/^[1-9][0-9]{0,19}$/u.test(value.workflowRunId)) {
    throw new Error("The protected frontend approval workflowRunId is invalid.");
  }
  if (!Number.isSafeInteger(value.workflowRunAttempt) || value.workflowRunAttempt < 1) {
    throw new Error("The protected frontend approval workflowRunAttempt is invalid.");
  }
  if (typeof value.requestedBy !== "string" || !/^@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u.test(value.requestedBy)) {
    throw new Error("The protected frontend approval must record the bounded workflow requester.");
  }
  if (
    typeof value.createdAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value.createdAt) ||
    Number.isNaN(Date.parse(value.createdAt))
  ) throw new Error("The protected frontend approval must have a canonical UTC timestamp.");
  return value;
}

export function createFrontendApprovalEnvelope({
  candidate,
  candidateProvenancePath,
  reviewRole,
  protectedEnvironment,
  repository,
  ref,
  workflowPath,
  workflowRunId,
  workflowRunAttempt,
  requestedBy,
  createdAt,
}) {
  const provenanceBytes = readFileSync(candidateProvenancePath);
  if (provenanceBytes.length === 0) throw new Error("Candidate provenance evidence must not be empty.");
  if (typeof requestedBy !== "string") throw new Error("A workflow requester is required.");
  const value = {
    kind: "lester-labs-protected-frontend-approval",
    schemaVersion: 1,
    sourceCommit: candidate.sourceCommit,
    reviewPayloadSha256: candidate.reviewPayloadSha256,
    candidateSha256: sha256Bytes(canonicalJson(candidate)),
    candidateProvenanceSha256: sha256Bytes(provenanceBytes),
    reviewRole,
    protectedEnvironment,
    repository,
    ref,
    workflowPath,
    workflowRunId,
    workflowRunAttempt: Number(workflowRunAttempt),
    requestedBy: requestedBy.startsWith("@") ? requestedBy : `@${requestedBy}`,
    createdAt,
  };
  return validateFrontendApprovalEnvelope(value, candidate);
}

export function approveFrontendReleaseCandidate({ candidate, approvals }) {
  if (!Array.isArray(approvals) || approvals.length !== 2) {
    throw new Error("Exactly two protected approval evidence packages are required.");
  }
  validateFrontendReleaseAttestation(candidate);
  if (candidate.status !== "CANDIDATE") throw new Error("Only a CANDIDATE manifest can be approved.");
  const validated = approvals.map(({ envelopePath, provenancePath }) => {
    const envelopeBytes = readFileSync(envelopePath);
    const provenanceBytes = readFileSync(provenancePath);
    if (provenanceBytes.length === 0) throw new Error("Approval provenance evidence must not be empty.");
    const envelope = validateFrontendApprovalEnvelope(
      JSON.parse(envelopeBytes.toString("utf8")),
      candidate,
    );
    return {
      envelope,
      reference: {
        reviewRole: envelope.reviewRole,
        protectedEnvironment: envelope.protectedEnvironment,
        rawSha256: sha256Bytes(envelopeBytes),
        provenanceSha256: sha256Bytes(provenanceBytes),
      },
    };
  });
  const runIdentities = new Set(validated.map(({ envelope }) => canonicalJson({
    repository: envelope.repository,
    ref: envelope.ref,
    workflowPath: envelope.workflowPath,
    workflowRunId: envelope.workflowRunId,
    workflowRunAttempt: envelope.workflowRunAttempt,
    candidateProvenanceSha256: envelope.candidateProvenanceSha256,
  })));
  if (runIdentities.size !== 1) {
    throw new Error("Protected frontend approvals do not belong to the same candidate workflow run.");
  }
  const approved = structuredClone(candidate);
  approved.status = "APPROVED";
  approved.approvalEnvelopes = validated
    .map(({ reference }) => reference)
    .sort((left, right) => left.reviewRole < right.reviewRole ? -1 : left.reviewRole > right.reviewRole ? 1 : 0);
  return validateFrontendReleaseAttestation(approved, {
    requireApproved: true,
    requireReleaseRuntime: true,
  });
}

function parseOptions(argumentsList) {
  const options = new Map();
  for (let index = 0; index < argumentsList.length; index += 1) {
    const name = argumentsList[index];
    if (!name.startsWith("--") || index + 1 >= argumentsList.length) {
      throw new Error(`Invalid command-line option ${JSON.stringify(name)}.`);
    }
    if (options.has(name)) throw new Error(`Duplicate command-line option ${name}.`);
    options.set(name, argumentsList[index + 1]);
    index += 1;
  }
  return options;
}

function requireOption(options, name) {
  const value = options.get(name);
  if (!value) throw new Error(`Missing required option ${name}.`);
  return value;
}

function writeJson(path, value) {
  writeFileSync(path, canonicalJson(value), { flag: "wx" });
}

async function main() {
  const [command, ...argumentsList] = process.argv.slice(2);
  if (command === "no-server-actions-build-key") {
    if (argumentsList.length !== 1) {
      throw new Error("Usage: frontend-release-attestation.mjs no-server-actions-build-key SOURCE_COMMIT");
    }
    console.log(deriveNoServerActionsBuildKey(argumentsList[0]));
    return;
  }
  if (command === "normalize-build") {
    const options = parseOptions(argumentsList);
    const allowed = new Set(["--build-dir", "--source-commit"]);
    for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option ${name}.`);
    normalizeFrontendBuild(
      resolve(requireOption(options, "--build-dir")),
      requireOption(options, "--source-commit"),
    );
    console.log("Normalized exact reviewed Next.js build manifests.");
    return;
  }
  if (command === "compare-file-inventories") {
    if (argumentsList.length !== 2) {
      throw new Error("Usage: frontend-release-attestation.mjs compare-file-inventories LEFT RIGHT");
    }
    console.log(canonicalJson(compareFileInventories(readJson(argumentsList[0]), readJson(argumentsList[1]))).trimEnd());
    return;
  }
  if (command === "compare") {
    if (argumentsList.length !== 2) throw new Error("Usage: frontend-release-attestation.mjs compare LEFT RIGHT");
    const result = compareFrontendArtifactInventories(readJson(argumentsList[0]), readJson(argumentsList[1]));
    console.log(canonicalJson(result).trimEnd());
    return;
  }
  if (command === "capture") {
    const options = parseOptions(argumentsList);
    const allowed = new Set(["--policy", "--local-origin", "--output"]);
    for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option ${name}.`);
    const policyPath = resolve(options.get("--policy") ?? defaultPolicyPath);
    const capture = await captureFrontendRouteResponses(
      requireOption(options, "--local-origin"),
      readJson(policyPath),
    );
    const outputPath = resolve(requireOption(options, "--output"));
    writeJson(outputPath, capture);
    console.log(`Wrote raw critical-route capture to ${outputPath}.`);
    return;
  }
  if (command === "package") {
    const options = parseOptions(argumentsList);
    const allowed = new Set(["--build-dir", "--output-dir"]);
    for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option ${name}.`);
    const summary = packageFrontendBuild(
      resolve(requireOption(options, "--build-dir")),
      resolve(requireOption(options, "--output-dir")),
    );
    console.log(`Packaged ${summary.fileCount} reviewed build files with digest ${summary.sha256}.`);
    return;
  }
  if (command === "deployable") {
    const options = parseOptions(argumentsList);
    const allowed = new Set(["--build-dir", "--public-dir", "--output-dir", "--inventory-output"]);
    for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option ${name}.`);
    const summary = packageFrontendDeployment(
      resolve(requireOption(options, "--build-dir")),
      resolve(requireOption(options, "--public-dir")),
      resolve(requireOption(options, "--output-dir")),
    );
    const inventoryOutput = resolve(requireOption(options, "--inventory-output"));
    writeJson(inventoryOutput, summary);
    console.log(`Packaged ${summary.fileCount} deployable standalone files with digest ${summary.sha256}.`);
    return;
  }
  if (command === "approval-envelope") {
    const options = parseOptions(argumentsList);
    const allowed = new Set([
      "--candidate", "--candidate-provenance", "--role", "--environment", "--repository",
      "--ref", "--workflow-path", "--run-id", "--run-attempt", "--requested-by", "--created-at",
      "--output",
    ]);
    for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option ${name}.`);
    const envelope = createFrontendApprovalEnvelope({
      candidate: readJson(resolve(requireOption(options, "--candidate"))),
      candidateProvenancePath: resolve(requireOption(options, "--candidate-provenance")),
      reviewRole: requireOption(options, "--role"),
      protectedEnvironment: requireOption(options, "--environment"),
      repository: requireOption(options, "--repository"),
      ref: requireOption(options, "--ref"),
      workflowPath: requireOption(options, "--workflow-path"),
      workflowRunId: requireOption(options, "--run-id"),
      workflowRunAttempt: requireOption(options, "--run-attempt"),
      requestedBy: requireOption(options, "--requested-by"),
      createdAt: requireOption(options, "--created-at"),
    });
    const outputPath = resolve(requireOption(options, "--output"));
    writeJson(outputPath, envelope);
    console.log(`Wrote protected ${envelope.reviewRole} approval envelope to ${outputPath}.`);
    return;
  }
  if (command === "approve") {
    const options = parseOptions(argumentsList);
    const allowed = new Set([
      "--candidate", "--source-envelope", "--source-provenance", "--operations-envelope",
      "--operations-provenance", "--output",
    ]);
    for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option ${name}.`);
    const approved = approveFrontendReleaseCandidate({
      candidate: readJson(resolve(requireOption(options, "--candidate"))),
      approvals: [
        {
          envelopePath: resolve(requireOption(options, "--source-envelope")),
          provenancePath: resolve(requireOption(options, "--source-provenance")),
        },
        {
          envelopePath: resolve(requireOption(options, "--operations-envelope")),
          provenancePath: resolve(requireOption(options, "--operations-provenance")),
        },
      ],
    });
    const outputPath = resolve(requireOption(options, "--output"));
    writeJson(outputPath, approved);
    console.log(`Wrote protected approved frontend release ${approved.reviewPayloadSha256} to ${outputPath}.`);
    return;
  }
  if (command !== "inventory" && command !== "attest") {
    throw new Error("Usage: frontend-release-attestation.mjs <inventory|attest|capture|compare|compare-file-inventories|no-server-actions-build-key|normalize-build|package|deployable|approval-envelope|approve> ...");
  }
  const options = parseOptions(argumentsList);
  const root = resolve(options.get("--root") ?? repositoryRoot);
  const shared = {
    root,
    buildDirectory: resolve(options.get("--build-dir") ?? join(root, ".next")),
    publicDirectory: resolve(options.get("--public-dir") ?? join(root, "public")),
    policyPath: resolve(options.get("--policy") ?? defaultPolicyPath),
    sourceCommit: requireOption(options, "--source-commit"),
    builderImage: requireOption(options, "--builder-image"),
  };
  const outputPath = resolve(requireOption(options, "--output"));
  if (command === "inventory") {
    const allowed = new Set([
      "--root", "--build-dir", "--public-dir", "--policy", "--source-commit",
      "--builder-image", "--output",
    ]);
    for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option ${name}.`);
    const inventory = createFrontendArtifactInventory(shared);
    writeJson(outputPath, inventory);
    console.log(`Wrote deterministic frontend inventory ${inventory.artifactInventory.sha256} to ${outputPath}.`);
    return;
  }
  const allowed = new Set([
    "--root", "--build-dir", "--public-dir", "--policy", "--source-commit", "--output",
    "--builder-image", "--sbom", "--local-origin", "--route-capture",
    "--deployment-artifact", "--deployment-inventory", "--release-profile",
  ]);
  for (const name of options.keys()) if (!allowed.has(name)) throw new Error(`Unknown option ${name}.`);
  const attestation = await createFrontendReleaseAttestation({
    ...shared,
    sbomPath: resolve(requireOption(options, "--sbom")),
    localOrigin: options.get("--local-origin"),
    routeCapturePath: options.has("--route-capture")
      ? resolve(options.get("--route-capture"))
      : undefined,
    deploymentArtifactPath: resolve(requireOption(options, "--deployment-artifact")),
    deploymentInventoryPath: resolve(requireOption(options, "--deployment-inventory")),
    releaseProfile: requireOption(options, "--release-profile"),
  });
  writeJson(outputPath, attestation);
  console.log(`Wrote candidate frontend release ${attestation.reviewPayloadSha256} to ${outputPath}.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
