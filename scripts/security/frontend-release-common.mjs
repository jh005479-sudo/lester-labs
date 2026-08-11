import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const REQUIRED_SECURITY_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "x-xss-protection",
];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const URL_EXPRESSION = /\b(?:https?|wss?):\/\/[^\s"'<>\\)]+/giu;
const ACTIVE_TAG_EXPRESSION = /<(script|img|iframe|source|video|audio|link|track|embed|object|input|image|use|feimage)\b(?:"[^"]*"|'[^']*'|[^'">])*>/giu;
const OPENING_TAG_EXPRESSION = /<[a-z][a-z0-9:-]*(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/giu;
const META_TAG_EXPRESSION = /<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/giu;
const BASE_TAG_EXPRESSION = /<base\b/iu;
// Browsers recover a slash between a tag name and its first attribute as an
// attribute separator (for example, <script/src=...>). Treat slash as a
// delimiter here too. False positives fail the release closed; missing one
// would let browser-active markup escape the inventory.
const SRCDOC_ATTRIBUTE_EXPRESSION = /(?:^|[\s/])srcdoc(?:\s*=|\s|>)/iu;
const ATTRIBUTE_EXPRESSION = /(?:^|[\s/])(src|href|poster|data|xlink:href|rel|type|http-equiv|content|style|ping)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/giu;
const SRCSET_EXPRESSION = /(?:^|[\s/])(srcset|imagesrcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/giu;
const CSS_URL_EXPRESSION = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s"')]+))\s*\)/giu;
const CSS_IMPORT_EXPRESSION = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^\s"') ;]+))/giu;
const NON_NETWORK_NAMESPACE_ORIGINS = new Set(["http://www.w3.org"]);
const HTML_URL_ENTITIES = Object.freeze({
  amp: "&",
  apos: "'",
  bsol: "\\",
  colon: ":",
  equals: "=",
  gt: ">",
  lt: "<",
  newline: "\n",
  num: "#",
  period: ".",
  quest: "?",
  quot: '"',
  sol: "/",
  tab: "\t",
});

export function canonicalizeJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, canonicalizeJson(child)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalizeJson(value), null, 2)}\n`;
}

export function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Canonical(value) {
  return sha256Bytes(canonicalJson(value));
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function assertExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${label} must contain exactly the reviewed fields.`);
  }
}

function normalizeOrigin(raw, label, { allowLoopbackHttp = false } = {}) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL origin.`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${label} must be an origin with no credentials, path, query, or fragment.`);
  }
  const loopback = ["127.0.0.1", "[::1]", "localhost"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && parsed.protocol !== "wss:") {
    if (!(allowLoopbackHttp && parsed.protocol === "http:" && loopback)) {
      throw new Error(`${label} must use HTTPS/WSS (or HTTP loopback for local capture).`);
    }
  }
  return parsed.origin;
}

function normalizedHeaderMap(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
}

export function validateFrontendReleasePolicy(value) {
  assertExactKeys(
    value,
    [
      "kind",
      "schemaVersion",
      "deploymentOrigins",
      "routes",
      "routeSourceCoverage",
      "reviewedSharedExecutionSources",
      "criticalResponseHeaders",
      "allowedThirdPartyOrigins",
      "allowedActiveResourceOrigins",
      "allowedArtifactEmbeddedOrigins",
      "maximumResponseBytes",
    ],
    "The frontend release policy",
  );
  if (value.kind !== "lester-labs-frontend-release-policy" || value.schemaVersion !== 1) {
    throw new Error("The frontend release policy kind or schema version is unsupported.");
  }
  if (!Array.isArray(value.deploymentOrigins) || value.deploymentOrigins.length !== 2) {
    throw new Error("The frontend release policy must declare exactly the apex and www origins.");
  }
  const deploymentOrigins = value.deploymentOrigins.map((origin, index) =>
    normalizeOrigin(origin, `deploymentOrigins[${index}]`),
  );
  if (new Set(deploymentOrigins).size !== deploymentOrigins.length) {
    throw new Error("Frontend deployment origins must be unique.");
  }
  if (!Array.isArray(value.routes) || value.routes.length === 0) {
    throw new Error("The frontend release policy must declare at least one critical route.");
  }
  for (const route of value.routes) {
    if (
      typeof route !== "string" ||
      !route.startsWith("/") ||
      route.startsWith("//") ||
      route.includes("?") ||
      route.includes("#") ||
      route.split("/").includes("..")
    ) {
      throw new Error(`Invalid critical route: ${JSON.stringify(route)}.`);
    }
  }
  if (new Set(value.routes).size !== value.routes.length) {
    throw new Error("Frontend critical routes must be unique.");
  }
  if (!Array.isArray(value.routeSourceCoverage) || value.routeSourceCoverage.length === 0) {
    throw new Error("routeSourceCoverage must enumerate every application page and route handler.");
  }
  let previousSourcePath = "";
  let previousProbePath = "";
  const coveredPageSourcePaths = new Set();
  const coveredProbePaths = new Set();
  const liveJsonSchemas = new Set(["explorer-summary-v1", "platform-stats-v1"]);
  for (const entry of value.routeSourceCoverage) {
    assertExactKeys(
      entry,
      ["sourcePath", "probePath", "verificationMode", "responseSchema"],
      "A frontend route-source coverage entry",
    );
    const isPage = /^src\/app\/(?:.*\/)?page\.(?:js|jsx|ts|tsx)$/u.test(entry.sourcePath ?? "");
    const isRoute = /^src\/app\/(?:.*\/)?route\.(?:js|jsx|ts|tsx)$/u.test(entry.sourcePath ?? "");
    if (!isPage && !isRoute) {
      throw new Error(`Invalid route-source path: ${JSON.stringify(entry.sourcePath)}.`);
    }
    if (
      previousSourcePath &&
      (entry.sourcePath < previousSourcePath ||
        (entry.sourcePath === previousSourcePath && entry.probePath <= previousProbePath))
    ) {
      throw new Error("routeSourceCoverage must be sorted by sourcePath and then unique probePath.");
    }
    previousSourcePath = entry.sourcePath;
    previousProbePath = entry.probePath;
    if (
      typeof entry.probePath !== "string" ||
      !entry.probePath.startsWith("/") ||
      entry.probePath.startsWith("//") ||
      entry.probePath.includes("#") ||
      entry.probePath.split(/[/?]/u).includes("..")
    ) throw new Error(`Invalid route-source probe path: ${JSON.stringify(entry.probePath)}.`);
    if (coveredProbePaths.has(entry.probePath)) {
      throw new Error("routeSourceCoverage probe paths must be unique.");
    }
    coveredProbePaths.add(entry.probePath);
    if (isPage) {
      if (coveredPageSourcePaths.has(entry.sourcePath)) {
        throw new Error(`Page ${entry.sourcePath} must have exactly one exact-build probe.`);
      }
      coveredPageSourcePaths.add(entry.sourcePath);
      if (
        entry.verificationMode !== "exact-build" ||
        entry.responseSchema !== null ||
        entry.probePath.includes("?") ||
        !value.routes.includes(entry.probePath)
      ) throw new Error(`Page ${entry.sourcePath} must use an exact-build probe listed in routes.`);
    } else if (
      entry.verificationMode !== "live-json" ||
      !liveJsonSchemas.has(entry.responseSchema) ||
      !entry.probePath.startsWith("/api/")
    ) {
      throw new Error(`Route handler ${entry.sourcePath} must use a reviewed live-JSON schema.`);
    }
  }
  if (
    !Array.isArray(value.reviewedSharedExecutionSources) ||
    value.reviewedSharedExecutionSources.some((path) => (
      typeof path !== "string" ||
      !/^src\/app\/(?:.*\/)?(?:layout|template|error|global-error|loading|not-found|default|sitemap|robots|manifest|icon|opengraph-image|twitter-image)\.(?:js|jsx|ts|tsx)$/u.test(path)
    )) ||
    JSON.stringify(value.reviewedSharedExecutionSources) !== JSON.stringify([...value.reviewedSharedExecutionSources].sort()) ||
    new Set(value.reviewedSharedExecutionSources).size !== value.reviewedSharedExecutionSources.length
  ) {
    throw new Error("reviewedSharedExecutionSources must be a sorted unique list of supported Next execution surfaces.");
  }
  if (
    !value.criticalResponseHeaders ||
    typeof value.criticalResponseHeaders !== "object" ||
    Array.isArray(value.criticalResponseHeaders)
  ) {
    throw new Error("criticalResponseHeaders must be a JSON object.");
  }
  const criticalResponseHeaders = normalizedHeaderMap(value.criticalResponseHeaders);
  if (
    Object.values(criticalResponseHeaders).some(
      (headerValue) => typeof headerValue !== "string" || headerValue.length === 0,
    )
  ) {
    throw new Error("Every critical response header must have a non-empty string value.");
  }
  for (const requiredHeader of REQUIRED_SECURITY_HEADERS) {
    if (!(requiredHeader in criticalResponseHeaders)) {
      throw new Error(`The critical response header policy omits ${requiredHeader}.`);
    }
  }
  if (!Array.isArray(value.allowedThirdPartyOrigins)) {
    throw new Error("allowedThirdPartyOrigins must be an array.");
  }
  if (!Array.isArray(value.allowedActiveResourceOrigins)) {
    throw new Error("allowedActiveResourceOrigins must be an array.");
  }
  if (!Array.isArray(value.allowedArtifactEmbeddedOrigins)) {
    throw new Error("allowedArtifactEmbeddedOrigins must be an array.");
  }
  const allowedThirdPartyOrigins = value.allowedThirdPartyOrigins.map((origin, index) =>
    normalizeOrigin(origin, `allowedThirdPartyOrigins[${index}]`),
  );
  const allowedActiveResourceOrigins = value.allowedActiveResourceOrigins.map((origin, index) =>
    normalizeOrigin(origin, `allowedActiveResourceOrigins[${index}]`),
  );
  const allowedArtifactEmbeddedOrigins = value.allowedArtifactEmbeddedOrigins.map((origin, index) =>
    normalizeOrigin(origin, `allowedArtifactEmbeddedOrigins[${index}]`, { allowLoopbackHttp: false }),
  );
  if (new Set(allowedThirdPartyOrigins).size !== allowedThirdPartyOrigins.length) {
    throw new Error("Allowed third-party origins must be unique.");
  }
  if (new Set(allowedActiveResourceOrigins).size !== allowedActiveResourceOrigins.length) {
    throw new Error("Allowed active-resource origins must be unique.");
  }
  if (new Set(allowedArtifactEmbeddedOrigins).size !== allowedArtifactEmbeddedOrigins.length) {
    throw new Error("Allowed embedded-artifact origins must be unique.");
  }
  const allowedThirdPartySet = new Set(allowedThirdPartyOrigins);
  for (const origin of allowedActiveResourceOrigins) {
    if (!allowedThirdPartySet.has(origin)) {
      throw new Error(`Active-resource origin ${origin} is not in the third-party allow-list.`);
    }
  }
  if (
    !Number.isSafeInteger(value.maximumResponseBytes) ||
    value.maximumResponseBytes < 1024 ||
    value.maximumResponseBytes > 50 * 1024 * 1024
  ) {
    throw new Error("maximumResponseBytes must be between 1 KiB and 50 MiB.");
  }

  return {
    ...value,
    deploymentOrigins,
    criticalResponseHeaders,
    allowedThirdPartyOrigins,
    allowedActiveResourceOrigins,
    allowedArtifactEmbeddedOrigins,
  };
}

export function validateRouteSourceCoverageAgainstSources(policy, sourcePaths) {
  const unsupportedExecutionSources = sourcePaths.filter((path) => (
    /^(?:src\/)?(?:middleware|proxy|instrumentation|instrumentation-client)\.(?:js|jsx|ts|tsx)$/u.test(path) ||
    /^(?:src\/)?pages\//u.test(path)
  ));
  if (unsupportedExecutionSources.length) {
    throw new Error(
      `Frontend release contains unsupported Next execution surfaces: ${unsupportedExecutionSources.sort().join(", ")}.`,
    );
  }
  const discovered = [...new Set(sourcePaths)]
    .filter((path) => /^src\/app\/(?:.*\/)?(?:page|route)\.(?:js|jsx|ts|tsx)$/u.test(path))
    .sort();
  const reviewed = [...new Set(policy.routeSourceCoverage.map(({ sourcePath }) => sourcePath))].sort();
  if (JSON.stringify(discovered) !== JSON.stringify(reviewed)) {
    const reviewedSet = new Set(reviewed);
    const discoveredSet = new Set(discovered);
    const missing = discovered.filter((path) => !reviewedSet.has(path));
    const stale = reviewed.filter((path) => !discoveredSet.has(path));
    throw new Error(
      `Frontend route-source coverage is incomplete${missing.length ? `; unreviewed: ${missing.join(", ")}` : ""}${stale.length ? `; stale: ${stale.join(", ")}` : ""}.`,
    );
  }
  const discoveredShared = [...new Set(sourcePaths)]
    .filter((path) => /^src\/app\/(?:.*\/)?(?:layout|template|error|global-error|loading|not-found|default|sitemap|robots|manifest|icon|opengraph-image|twitter-image)\.(?:js|jsx|ts|tsx)$/u.test(path))
    .sort();
  if (JSON.stringify(discoveredShared) !== JSON.stringify(policy.reviewedSharedExecutionSources)) {
    const reviewedSet = new Set(policy.reviewedSharedExecutionSources);
    const discoveredSet = new Set(discoveredShared);
    const missing = discoveredShared.filter((path) => !reviewedSet.has(path));
    const stale = policy.reviewedSharedExecutionSources.filter((path) => !discoveredSet.has(path));
    throw new Error(
      `Frontend shared execution-surface coverage is incomplete${missing.length ? `; unreviewed: ${missing.join(", ")}` : ""}${stale.length ? `; stale: ${stale.join(", ")}` : ""}.`,
    );
  }
  return {
    complete: true,
    routeSourceCount: discovered.length,
    sharedExecutionSourceCount: discoveredShared.length,
  };
}

export function assertProductionFrontendReleasePolicy(policy) {
  const expected = ["https://lester-labs.com", "https://www.lester-labs.com"];
  if (JSON.stringify(policy.deploymentOrigins) !== JSON.stringify(expected)) {
    throw new Error("Production parity is restricted to the reviewed Lester Labs apex and www origins.");
  }
}

function decodeHtmlUrlEntities(candidate) {
  const numericDecoded = candidate.replace(
    /&#(?:x([0-9a-f]{1,8})|([0-9]{1,10}));?/giu,
    (_match, hexadecimal, decimal) => {
      const codePoint = Number.parseInt(hexadecimal ?? decimal, hexadecimal ? 16 : 10);
      if (
        !Number.isSafeInteger(codePoint) ||
        codePoint <= 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) return "\uFFFD";
      return String.fromCodePoint(codePoint);
    },
  );
  return numericDecoded.replace(/&([a-z][a-z0-9]+);/giu, (match, rawName) => {
    const replacement = HTML_URL_ENTITIES[rawName.toLowerCase()];
    if (replacement === undefined) {
      throw new Error(`A URL-bearing HTML attribute contains an unsupported named entity ${match}.`);
    }
    return replacement;
  });
}

function cleanUrlCandidate(candidate) {
  return decodeHtmlUrlEntities(candidate).replace(/[.,;\]}]+$/u, "");
}

function originFromCandidate(candidate, baseUrl) {
  try {
    const parsed = new URL(cleanUrlCandidate(candidate), baseUrl);
    if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function observeEmbeddedNetworkOrigins(text, baseUrl = "https://www.lester-labs.com/") {
  const origins = new Set();
  for (const match of text.matchAll(URL_EXPRESSION)) {
    const origin = originFromCandidate(match[0], baseUrl);
    if (origin && !NON_NETWORK_NAMESPACE_ORIGINS.has(origin)) origins.add(origin);
  }
  return [...origins].sort();
}

function attributesFromTag(tag) {
  const attributes = new Map();
  for (const attribute of tag.matchAll(ATTRIBUTE_EXPRESSION)) {
    const name = attribute[1].toLowerCase();
    if (attributes.has(name)) {
      throw new Error(`An active HTML tag contains duplicate ${name} attributes.`);
    }
    attributes.set(name, decodeHtmlUrlEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? ""));
  }
  for (const srcset of tag.matchAll(SRCSET_EXPRESSION)) {
    const name = srcset[1].toLowerCase();
    if (attributes.has(name)) {
      throw new Error(`An active HTML tag contains duplicate ${name} attributes.`);
    }
    attributes.set(name, decodeHtmlUrlEntities(srcset[2] ?? srcset[3] ?? srcset[4] ?? ""));
  }
  return attributes;
}

function cssResourceCandidates(css) {
  const candidates = [];
  for (const match of css.matchAll(CSS_URL_EXPRESSION)) {
    candidates.push(decodeHtmlUrlEntities(match[1] ?? match[2] ?? match[3] ?? ""));
  }
  for (const match of css.matchAll(CSS_IMPORT_EXPRESSION)) {
    candidates.push(decodeHtmlUrlEntities(match[1] ?? match[2] ?? match[3] ?? ""));
  }
  return candidates;
}

function activeResourceCandidates(body) {
  if (BASE_TAG_EXPRESSION.test(body)) {
    throw new Error("Frontend release HTML must not contain a base element that changes URL resolution.");
  }
  if (SRCDOC_ATTRIBUTE_EXPRESSION.test(body)) {
    throw new Error("Frontend release HTML must not contain iframe srcdoc content.");
  }
  for (const metaTag of body.matchAll(META_TAG_EXPRESSION)) {
    const attributes = attributesFromTag(metaTag[0]);
    if ((attributes.get("http-equiv") ?? "").trim().toLowerCase() === "refresh") {
      throw new Error("Frontend release HTML must not contain a meta refresh.");
    }
  }

  const candidates = [];
  // CSS URLs can load network resources from a style attribute on any HTML or
  // SVG element, not only from elements that also have src/href-like
  // attributes. Scan every opening tag independently of the active-tag pass.
  for (const tagMatch of body.matchAll(OPENING_TAG_EXPRESSION)) {
    const attributes = attributesFromTag(tagMatch[0]);
    const inlineStyle = attributes.get("style");
    if (inlineStyle !== undefined) candidates.push(...cssResourceCandidates(inlineStyle));
  }
  for (const tagMatch of body.matchAll(ACTIVE_TAG_EXPRESSION)) {
    const [tag, rawName] = tagMatch;
    const tagName = rawName.toLowerCase();
    const attributes = attributesFromTag(tag);
    if (tagName === "link") {
      const relation = (attributes.get("rel") ?? "").toLowerCase();
      if (!/(?:^|\s)(?:stylesheet|preload|modulepreload|icon|manifest|prefetch|prerender|dns-prefetch|preconnect)(?:\s|$)/u.test(relation)) {
        continue;
      }
    }
    if (tagName === "input" && (attributes.get("type") ?? "").trim().toLowerCase() !== "image") {
      continue;
    }
    const allowedAttributes = tagName === "object"
      ? ["data"]
      : ["src", "href", "poster", "xlink:href"];
    for (const name of allowedAttributes) {
      const value = attributes.get(name);
      if (value !== undefined) candidates.push(value);
    }
    for (const name of ["srcset", "imagesrcset"]) {
      const value = attributes.get(name);
      if (value === undefined) continue;
      for (const item of value.split(",")) candidates.push(item.trim().split(/\s+/u)[0]);
    }
  }
  for (const styleMatch of body.matchAll(/<style\b(?:"[^"]*"|'[^']*'|[^'">])*?>([\s\S]*?)<\/style\s*>/giu)) {
    candidates.push(...cssResourceCandidates(styleMatch[1]));
  }
  return candidates;
}

function sameOriginAssetPath(candidate, baseUrl, firstPartyOrigins) {
  try {
    const parsed = new URL(decodeHtmlUrlEntities(candidate), baseUrl);
    if (!firstPartyOrigins.has(parsed.origin) || parsed.username || parsed.password) return null;
    if (parsed.search) {
      throw new Error(`A first-party active-resource URL contains an unreviewed query string: ${parsed.pathname}${parsed.search}.`);
    }
    return parsed.pathname;
  } catch {
    if (candidate.includes("?") || candidate.includes("&#")) throw new Error("An active-resource URL could not be resolved safely.");
    return null;
  }
}

export function observeResponseBody(body, baseUrl, responseHeaders, policy) {
  const firstPartyOrigins = new Set([...policy.deploymentOrigins, new URL(baseUrl).origin]);
  const thirdPartyOrigins = new Set();
  const activeResourceOrigins = new Set();
  const referencedActiveResourcePaths = new Set();
  const combined = `${body}\n${responseHeaders["content-security-policy"] ?? ""}`;

  for (const match of combined.matchAll(URL_EXPRESSION)) {
    const origin = originFromCandidate(match[0], baseUrl);
    if (
      origin &&
      !firstPartyOrigins.has(origin) &&
      !NON_NETWORK_NAMESPACE_ORIGINS.has(origin)
    ) thirdPartyOrigins.add(origin);
  }
  for (const candidate of activeResourceCandidates(body)) {
    const origin = originFromCandidate(candidate, baseUrl);
    if (
      origin &&
      !firstPartyOrigins.has(origin) &&
      !NON_NETWORK_NAMESPACE_ORIGINS.has(origin)
    ) activeResourceOrigins.add(origin);
    const path = sameOriginAssetPath(candidate, baseUrl, firstPartyOrigins);
    if (path) referencedActiveResourcePaths.add(path);
  }

  return {
    thirdPartyOrigins: [...thirdPartyOrigins].sort(),
    activeResourceOrigins: [...activeResourceOrigins].sort(),
    referencedActiveResourcePaths: [...referencedActiveResourcePaths].sort(),
  };
}

export function verifyResponsePolicy(headers, observation, policy) {
  const actualHeaders = {};
  for (const [name, expectedValue] of Object.entries(policy.criticalResponseHeaders)) {
    const actual = headers[name.toLowerCase()];
    if (actual !== expectedValue) {
      throw new Error(
        `Critical response header ${name} is ${JSON.stringify(actual)}; expected ${JSON.stringify(expectedValue)}.`,
      );
    }
    actualHeaders[name.toLowerCase()] = actual;
  }
  const allowedThirdPartyOrigins = new Set(policy.allowedThirdPartyOrigins);
  const allowedActiveResourceOrigins = new Set(policy.allowedActiveResourceOrigins);
  for (const origin of observation.thirdPartyOrigins) {
    if (!allowedThirdPartyOrigins.has(origin)) {
      throw new Error(`Response exposes unreviewed third-party origin ${origin}.`);
    }
  }
  for (const origin of observation.activeResourceOrigins) {
    if (!allowedActiveResourceOrigins.has(origin)) {
      throw new Error(`Response loads an unreviewed active-resource origin ${origin}.`);
    }
  }
  return actualHeaders;
}

function headersToObject(headers) {
  const values = {};
  for (const [name, value] of headers.entries()) values[name.toLowerCase()] = value;
  return values;
}

async function readBoundedBody(response, maximumResponseBytes) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    if (
      !/^(?:0|[1-9][0-9]{0,15})$/u.test(declaredLength) ||
      !Number.isSafeInteger(Number(declaredLength))
    ) throw new Error("Response has a malformed Content-Length header.");
    if (Number(declaredLength) > maximumResponseBytes) {
      throw new Error(`Response declares ${declaredLength} bytes, above the reviewed limit.`);
    }
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximumResponseBytes) {
      await reader.cancel("reviewed response byte limit exceeded");
      throw new Error(`Response contains more than ${maximumResponseBytes} bytes, above the reviewed limit.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length);
}

export async function fetchBounded(
  initialUrl,
  {
    allowedOrigins,
    maximumResponseBytes,
    fetchImpl = globalThis.fetch,
    attempts = 1,
    retryDelayMs = 250,
    userAgent = "Lester-Labs-Local-Release-Capture/1.0",
  },
) {
  if (typeof fetchImpl !== "function") throw new Error("A Fetch implementation is required.");
  let finalError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      let currentUrl = new URL(initialUrl);
      for (let redirect = 0; redirect <= 5; redirect += 1) {
        if (!allowedOrigins.has(currentUrl.origin)) {
          throw new Error(`Refusing redirect or request to unreviewed origin ${currentUrl.origin}.`);
        }
        const response = await fetchImpl(currentUrl, {
          method: "GET",
          redirect: "manual",
          credentials: "omit",
          cache: "no-store",
          headers: {
            accept: "*/*",
            "user-agent": userAgent,
          },
          signal: AbortSignal.timeout(15_000),
        });
        if (REDIRECT_STATUSES.has(response.status)) {
          const location = response.headers.get("location");
          if (!location) throw new Error(`Redirect ${response.status} omitted a Location header.`);
          if (response.body) await response.body.cancel();
          currentUrl = new URL(location, currentUrl);
          continue;
        }
        if (response.status !== 200) {
          throw new Error(`${currentUrl.href} returned HTTP ${response.status}.`);
        }
        const bytes = await readBoundedBody(response, maximumResponseBytes);
        return {
          requestedUrl: initialUrl,
          finalUrl: currentUrl.href,
          status: response.status,
          headers: headersToObject(response.headers),
          bytes,
        };
      }
      throw new Error(`${initialUrl} exceeded the five-redirect limit.`);
    } catch (error) {
      finalError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  throw finalError;
}

export function assertHash(value, label) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
}

export function headersForPolicy(responseHeaders, policy) {
  return Object.fromEntries(
    Object.keys(policy.criticalResponseHeaders)
      .sort()
      .map((name) => [name, responseHeaders[name]]),
  );
}
