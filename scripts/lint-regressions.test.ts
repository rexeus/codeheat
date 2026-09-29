import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = new URL("..", import.meta.url).pathname;
const oxlint = join(repositoryRoot, "node_modules/oxlint/bin/oxlint");
const fixtureRoots: string[] = [];

const runLint = (
  config: string,
  source: string,
  extraArguments: string[] = [],
) => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "codeheat-lint-"));
  fixtureRoots.push(fixtureRoot);
  symlinkSync(
    join(repositoryRoot, "node_modules"),
    join(fixtureRoot, "node_modules"),
    "dir",
  );
  writeFileSync(
    join(fixtureRoot, "tsconfig.json"),
    JSON.stringify({
      extends: join(repositoryRoot, "tsconfig.json"),
      include: ["fixture.ts"],
    }),
  );
  const fixture = join(fixtureRoot, "fixture.ts");
  writeFileSync(fixture, source);

  return spawnSync(
    process.execPath,
    [
      oxlint,
      "--config",
      join(repositoryRoot, config),
      "--tsconfig",
      join(fixtureRoot, "tsconfig.json"),
      "--deny-warnings",
      ...extraArguments,
      fixture,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
};

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

describe("lint regression probes", () => {
  it("keeps type-aware no-unsafe rules enabled", () => {
    const result = runLint(
      ".oxlintrc.json",
      'const value = JSON.parse("{}");\nvalue.maybe();\n',
      ["--type-aware", "--type-check"],
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("typescript(no-unsafe-assignment)");
    expect(result.stdout).toContain("typescript(no-unsafe-call)");
    expect(result.stdout).toContain("typescript(no-unsafe-member-access)");
  });

  it("keeps the Effect floating-value rule enabled", () => {
    const result = runLint(
      ".oxlint-effect.json",
      'import { Effect } from "effect";\nEffect.succeed(1);\n',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("effecttsgo(floating-effect)");
  });

  it("reports stale disable directives", () => {
    const result = runLint(
      ".oxlintrc.json",
      "// oxlint-disable-next-line no-console\nconst value = 1;\nvoid value;\n",
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("Unused oxlint-disable directive");
  });

  it("rejects explicit any", () => {
    const result = runLint(
      ".oxlintrc.json",
      "export const widen = (value: any): unknown => value;\n",
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("typescript(no-explicit-any)");
  });

  it("caps source files at 250 lines", () => {
    const lines = Array.from(
      { length: 251 },
      (_, index) => `export const value${index} = ${index};`,
    );
    const result = runLint(".oxlintrc.json", `${lines.join("\n")}\n`);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("eslint(max-lines)");
  });

  it("keeps the cognitive complexity threshold enforced", () => {
    const result = runLint(
      ".oxlintrc.json",
      `const complex = (value: number): number => {
        if (value > 0) { if (value > 1) { if (value > 2) {
          if (value > 3) { if (value > 4) { if (value > 5) { return 1; } } }
        } } }
        return 0;
      };\n`,
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("sonarjs(cognitive-complexity)");
    expect(result.stdout).toContain("15 allowed");
  });
});
