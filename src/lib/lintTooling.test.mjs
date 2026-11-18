import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("lint fails on conditional Hooks and reports TypeScript, navigation and accessibility issues", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lester-lint-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const fixture = join(directory, "example.tsx");
  writeFileSync(fixture, `import { useState } from 'react';
export function Example({ enabled }: { enabled: any }) {
  if (enabled) useState(0);
  window.location.assign('/projects');
  return <img src="/example.png" />;
}\n`);
  const result = spawnSync(process.execPath, [
    "node_modules/oxlint/bin/oxlint", "-c", ".oxlintrc.json", "-f", "json", fixture,
  ], { cwd: root, encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const { diagnostics } = JSON.parse(result.stdout);
  const severity = new Map(diagnostics.map(({ code, severity }) => [code, severity]));
  assert.equal(severity.get("react-hooks-js(rules-of-hooks)"), "error");
  assert.equal(severity.get("next-navigation(no-location-assign-relative-destination)"), "warning");
  assert.equal(severity.get("typescript(no-explicit-any)"), "warning");
  assert.equal(severity.get("jsx-a11y(alt-text)"), "warning");
  assert.equal(severity.get("next(no-img-element)"), "warning");
});
