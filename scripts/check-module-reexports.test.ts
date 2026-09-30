import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const script = new URL("check-module-reexports.ts", import.meta.url).pathname;
const fixtureRoots: string[] = [];

const checkWorkspace = (files: Record<string, string>) => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "codeheat-reexports-"));
  fixtureRoots.push(fixtureRoot);
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(dirname(join(fixtureRoot, file)), { recursive: true });
    writeFileSync(join(fixtureRoot, file), source);
  }
  return spawnSync(process.execPath, [script], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
};

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

describe("module re-export check", () => {
  it("accepts export lists in a package entry point", () => {
    const result = checkWorkspace({
      "packages/engine/src/index.ts":
        'export { analyze } from "./analyze.js";\n',
    });

    expect(result.status).toBe(0);
  });

  it("rejects export lists outside the package entry point", () => {
    const result = checkWorkspace({
      "packages/engine/src/metrics/index.ts":
        'export * from "./complexity.js";\n',
      "packages/engine/src/report.ts": 'export { score } from "./score.js";\n',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("packages/engine/src/metrics/index.ts:1");
    expect(result.stderr).toContain("packages/engine/src/report.ts:1");
  });
});
