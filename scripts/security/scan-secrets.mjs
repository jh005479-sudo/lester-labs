import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const maximumFileSize = 5 * 1024 * 1024;
const placeholderPattern = /^(?:|undefined|null|none|false|0|x+|\*+|\.\.\.|<[^>]+>|\$\{[^}]+\}|.*(?:change[-_ ]?me|dummy|example|fake|not[-_ ]?real|placeholder|replace[-_ ]?me|sample|test[-_ ]?only|your[-_ ]?).*)$/iu;
const rules = [
  {
    id: "pem-private-key",
    expression: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  },
  {
    id: "github-token",
    expression: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{20,255})\b/u,
  },
  {
    id: "aws-access-key-id",
    expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  },
  {
    id: "slack-token",
    expression: /\bxox[baprs]-[A-Za-z0-9-]{10,255}\b/u,
  },
  {
    id: "wallet-private-key-literal",
    expression:
      /(?:DEPLOYER[_-]?PRIVATE[_-]?KEY|WALLET[_-]?PRIVATE[_-]?KEY|PRIVATE[_-]?KEY|privateKey|secretKey)\s*[:=]\s*["']?((?:0x)?[0-9a-fA-F]{64})\b/iu,
    valueGroup: 1,
  },
  {
    id: "private-key-command-argument",
    expression: /--(?:private|secret|wallet)-key(?:=|\s+)["']?((?:0x)?[0-9a-fA-F]{64})\b/iu,
    valueGroup: 1,
  },
  {
    id: "mnemonic-literal",
    expression: /(?:MNEMONIC|SEED_PHRASE)\s*[:=]\s*["']([^"'\r\n]{20,})["']/iu,
    valueGroup: 1,
  },
  {
    id: "secret-literal",
    expression:
      /(?:API[_-]?KEY|CLIENT[_-]?SECRET|AUTH[_-]?TOKEN|ACCESS[_-]?TOKEN|PASSWORD)\s*[:=]\s*["']([^"'\r\n]{8,})["']/iu,
    valueGroup: 1,
  },
  {
    id: "environment-secret",
    expression:
      /^(?:export\s+)?[A-Z0-9_]*(?:PRIVATE_KEY|CLIENT_SECRET|PASSWORD|AUTH_TOKEN|ACCESS_TOKEN|MNEMONIC|SEED_PHRASE|API_KEY)[A-Z0-9_]*\s*=\s*(.*)$/u,
    valueGroup: 1,
  },
];

function normalizeCandidate(value) {
  return value
    .trim()
    .replace(/^['"]|['"]$/gu, "")
    .replace(/\s+#.*$/u, "")
    .trim();
}

function isPlaceholder(value) {
  const normalized = normalizeCandidate(value);
  return placeholderPattern.test(normalized) || normalized.startsWith("process.env.");
}

const candidateFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  },
)
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const findings = [];
let scannedFiles = 0;

function scanText(source, contents) {
  const lines = contents.toString("utf8").split(/\r?\n/u);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (const rule of rules) {
      const match = rule.expression.exec(line);
      if (!match) continue;

      const candidate = rule.valueGroup ? match[rule.valueGroup] : match[0];
      if (rule.valueGroup && isPlaceholder(candidate)) continue;

      findings.push({
        path: source,
        line: lineIndex + 1,
        rule: rule.id,
      });
    }
  }
}

for (const relativePath of candidateFiles) {
  const absolutePath = join(repositoryRoot, relativePath);
  if (!existsSync(absolutePath)) continue;
  if (statSync(absolutePath).size > maximumFileSize) continue;

  const contents = readFileSync(absolutePath);
  if (contents.subarray(0, 8192).includes(0)) continue;

  scannedFiles += 1;
  scanText(relativePath, contents);
}

// Scan every unique historical Git blob as well as the worktree. A secret
// removed from the current tree remains retrievable from Git history and must
// still be treated as compromised. `cat-file --batch` avoids checking out or
// executing any historical content.
const historicalObjects = execFileSync(
  "git",
  ["rev-list", "--objects", "--all"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
)
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => {
    const separator = line.indexOf(" ");
    return separator === -1
      ? { objectId: line, path: "<unresolved>" }
      : { objectId: line.slice(0, separator), path: line.slice(separator + 1) };
  });

const firstPathByObject = new Map();
for (const entry of historicalObjects) {
  if (!firstPathByObject.has(entry.objectId)) firstPathByObject.set(entry.objectId, entry.path);
}
const uniqueObjectIds = [...firstPathByObject.keys()];
const batchCheck = execFileSync(
  "git",
  ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
  {
    cwd: repositoryRoot,
    input: `${uniqueObjectIds.join("\n")}\n`,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);
const historicalBlobIds = batchCheck
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => line.split(" "))
  .filter(([, type, size]) => type === "blob" && Number(size) <= maximumFileSize)
  .map(([objectId]) => objectId);

if (historicalBlobIds.length > 0) {
  const batch = execFileSync("git", ["cat-file", "--batch"], {
    cwd: repositoryRoot,
    input: `${historicalBlobIds.join("\n")}\n`,
    maxBuffer: 512 * 1024 * 1024,
  });
  let cursor = 0;
  let scannedHistoricalBlobs = 0;

  while (cursor < batch.length) {
    const headerEnd = batch.indexOf(0x0a, cursor);
    if (headerEnd === -1) throw new Error("Malformed git cat-file batch header.");
    const [objectId, type, sizeText] = batch.subarray(cursor, headerEnd).toString("utf8").split(" ");
    const size = Number(sizeText);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (type !== "blob" || !Number.isSafeInteger(size) || contentEnd > batch.length) {
      throw new Error("Malformed git cat-file blob response.");
    }
    const contents = batch.subarray(contentStart, contentEnd);
    cursor = contentEnd + 1;
    if (contents.subarray(0, 8192).includes(0)) continue;
    scannedHistoricalBlobs += 1;
    scanText(`git-history:${firstPathByObject.get(objectId) ?? "<unknown>"}@${objectId.slice(0, 12)}`, contents);
  }

  scannedFiles += scannedHistoricalBlobs;
}

if (findings.length > 0) {
  console.error("Potential committed secrets detected (values are intentionally redacted):");
  for (const finding of findings) {
    console.error(`- ${finding.path}:${finding.line} [${finding.rule}]`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Secret scan passed for ${scannedFiles} current files and unique historical Git text blobs.`,
  );
}
