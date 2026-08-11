#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultRoot = join(repositoryRoot, "emergency-site");
const EXPECTED_FILES = Object.freeze([
  ".well-known/security.txt",
  "index.html",
  "robots.txt",
  "vercel.json",
]);
const EXPECTED_FILE_SHA256 = Object.freeze({
  ".well-known/security.txt": "2fb5448efae58ddd4e34a09abace9d451601cec9d4ba792349da53d84a737585",
  "index.html": "d9b43613185227433a6b08fabfe97d1baa967f209f373a7ae539cf6a3e5f2d22",
  "robots.txt": "331ea9090db0c9f6f597bd9840fd5b171830f6e0b3ba1cb24dfa91f0c95aedc1",
  "vercel.json": "e04a2fe51b01eaa5bcad430faedcba9f4cbc3f47b2b2db81ff6878e47f8d8b22",
});
const EXPECTED_METRICS = Object.freeze({
  onChainMessages: 66_776,
  presalesCreated: 8_451,
  swapsCompleted: 12_975,
  tokensMinted: 500_139,
  walletsAirdropped: 16_433,
});
const EXPECTED_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Clear-Site-Data": '"cache", "cookies", "storage"',
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; manifest-src 'none'; upgrade-insecure-requests",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
});
const EXPECTED_METRIC_PRESENTATION = Object.freeze({
  tokensMinted: Object.freeze({ value: 500_139, display: "500,139", label: "token creation actions" }),
  walletsAirdropped: Object.freeze({ value: 16_433, display: "16,433", label: "airdrop recipient entries" }),
  presalesCreated: Object.freeze({ value: 8_451, display: "8,451", label: "presale creation actions" }),
  swapsCompleted: Object.freeze({ value: 12_975, display: "12,975", label: "swap actions" }),
  onChainMessages: Object.freeze({ value: 66_776, display: "66,776", label: "on-chain message actions" }),
});
const EXPECTED_SECURITY_TXT = `Contact: mailto:security@lester-labs.com
Canonical: https://www.lester-labs.com/.well-known/security.txt
Expires: 2027-08-10T23:59:59Z
Preferred-Languages: en
Policy: https://github.com/jh005479-sudo/lester-labs/security/policy
`;
const ALLOWED_HTML_TAGS = new Set([
  "body", "br", "code", "div", "footer", "h1", "head", "html", "main",
  "meta", "p", "section", "span", "strong", "style", "title",
]);

function portable(path) {
  return path.split(sep).join("/");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function inventoryFiles(root) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolutePath = join(directory, entry.name);
      const relativePath = portable(relative(root, absolutePath));
      if (entry.isSymbolicLink()) throw new Error(`Emergency artifact refuses symlink ${relativePath}.`);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        const metadata = lstatSync(absolutePath);
        if (metadata.size > 256_000) throw new Error(`Emergency artifact file is oversized: ${relativePath}.`);
        const bytes = readFileSync(absolutePath);
        files.push({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
      } else {
        throw new Error(`Emergency artifact refuses special file ${relativePath}.`);
      }
    }
  }
  visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function assertHtml(html) {
  for (const forbidden of [
    /<\s*(?:script|iframe|frame|object|embed|form|input|button|select|textarea|video|audio|source|track|link|base)\b/iu,
    /\bon[a-z]+\s*=/iu,
    /\b(?:src|href|action|poster|srcset)\s*=/iu,
    /\b(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/iu,
    /\b(?:https?|wss?):\/\//iu,
    /<\s*meta\b[^>]*http-equiv/iu,
    /\b(?:url|image-set|cross-fade)\s*\(/iu,
    /@(?:import|font-face|namespace|supports|document)\b/iu,
    /\b(?:provide|enter|type|send|share|upload|submit)\b[^.]{0,120}\b(?:credential|secret|seed|private key|password|wallet backup|recovery phrase|payment)\b/iu,
  ]) {
    if (forbidden.test(html)) throw new Error(`Emergency HTML contains forbidden active markup matching ${forbidden}.`);
  }
  for (const match of html.matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9-]*)\b/gu)) {
    const tagName = match[1].toLowerCase();
    if (!ALLOWED_HTML_TAGS.has(tagName)) {
      throw new Error(`Emergency HTML contains unreviewed element ${tagName}.`);
    }
  }
  for (const [name, presentation] of Object.entries(EXPECTED_METRIC_PRESENTATION)) {
    const escapedDisplay = presentation.display.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const escapedLabel = presentation.label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const expression = new RegExp(
      `<div class=["']metric["'] data-metric=["']${name}["'] data-value=["']${presentation.value}["']>\\s*` +
      `<strong>${escapedDisplay}</strong>\\s*<span>${escapedLabel}</span>\\s*</div>`,
      "u",
    );
    if (!expression.test(html)) {
      throw new Error(`Emergency HTML omits exact reviewed visible metric ${name}=${presentation.display}.`);
    }
  }
  const normalizedText = html.replace(/\s+/gu, " ");
  for (const disclosure of [
    "Wallet connections, signatures, approvals, and transactions are disabled",
    "Lester Labs does not operate or verify any LitVM reward, allocation, eligibility, snapshot, or activity-farming campaign",
    "action/address counts—not unique users or an independent audit",
    "provisional incident floor",
    "No wallet, seed phrase, private key, password, or payment will ever be requested",
  ]) {
    if (!normalizedText.includes(disclosure)) throw new Error(`Emergency HTML omits required disclosure: ${disclosure}.`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} contains unreviewed fields.`);
  }
}

function assertVercelConfiguration(configuration) {
  assertExactKeys(configuration, ["$schema", "git", "headers"], "Emergency Vercel configuration");
  assertExactKeys(configuration.git, ["deploymentEnabled"], "Emergency Vercel Git configuration");
  if (
    configuration.$schema !== "https://openapi.vercel.sh/vercel.json" ||
    JSON.stringify(configuration.git) !== JSON.stringify({ deploymentEnabled: false }) ||
    !Array.isArray(configuration.headers) ||
    configuration.headers.length !== 1 ||
    configuration.headers[0]?.source !== "/(.*)"
  ) throw new Error("Emergency Vercel deployment and header scope is not fail-closed.");
  assertExactKeys(configuration.headers[0], ["source", "headers"], "Emergency Vercel header rule");
  if (!Array.isArray(configuration.headers[0].headers)) {
    throw new Error("Emergency Vercel headers must be an array.");
  }
  const headerEntries = configuration.headers[0].headers;
  for (const entry of headerEntries) {
    assertExactKeys(entry, ["key", "value"], "Emergency Vercel header entry");
  }
  const headers = Object.fromEntries(headerEntries.map(({ key, value }) => [key, value]));
  if (new Set(headerEntries.map(({ key }) => key)).size !== headerEntries.length) {
    throw new Error("Emergency Vercel security headers must be unique.");
  }
  if (canonicalJson(headers) !== canonicalJson(EXPECTED_HEADERS)) {
    throw new Error("Emergency Vercel security headers differ from the reviewed policy.");
  }
}

export function verifyEmergencyContainment({ root = defaultRoot } = {}) {
  const metadata = lstatSync(root);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("Emergency artifact root must be a regular directory.");
  }
  const files = inventoryFiles(root);
  if (JSON.stringify(files.map(({ path }) => path)) !== JSON.stringify(EXPECTED_FILES)) {
    throw new Error("Emergency artifact must contain exactly the four reviewed static files.");
  }
  assertHtml(readFileSync(join(root, "index.html"), "utf8"));
  assertVercelConfiguration(JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")));
  const robots = readFileSync(join(root, "robots.txt"), "utf8");
  if (robots !== "User-agent: *\nDisallow: /\n") throw new Error("Emergency robots policy must disallow crawling.");
  const security = readFileSync(join(root, ".well-known/security.txt"), "utf8");
  if (security !== EXPECTED_SECURITY_TXT) {
    throw new Error("Emergency security.txt differs from the complete reviewed policy.");
  }
  for (const file of files) {
    if (file.sha256 !== EXPECTED_FILE_SHA256[file.path]) {
      throw new Error(`Emergency artifact ${file.path} differs from its reviewed exact digest.`);
    }
  }
  const payload = {
    kind: "lester-labs-wallet-free-emergency-containment",
    schemaVersion: 1,
    interactionSurface: "none",
    analyticsFloor: EXPECTED_METRICS,
    files,
  };
  return { ...payload, evidenceSha256: sha256(Buffer.from(canonicalJson(payload))) };
}

function main() {
  const argumentsList = process.argv.slice(2);
  let root = defaultRoot;
  let output;
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!value || !["--root", "--output"].includes(name)) throw new Error(`Invalid option ${name}.`);
    if (name === "--root") root = resolve(value);
    if (name === "--output") output = resolve(value);
  }
  const result = verifyEmergencyContainment({ root });
  const rendered = canonicalJson(result);
  if (output) {
    writeFileSync(output, rendered, { flag: "wx", mode: 0o600 });
    process.stdout.write(`Emergency containment verified: ${result.evidenceSha256}\n`);
  } else {
    process.stdout.write(rendered);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
