import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = new URL("..", import.meta.url).pathname;
const oxlint = join(repositoryRoot, "node_modules/oxlint/bin/oxlint");
const fixtureRoots: string[] = [];
const probeFiles: string[] = [];

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
      "--format=default",
      ...extraArguments,
      fixture,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
};

/**
 * Lints `source` as a file inside `<directory>` (e.g. `packages/engine/src`),
 * where the override-scoped import rules apply. The probe lives in the real
 * package directory under a unique name and is removed in `afterEach`.
 */
const runPackageLint = (directory: string, source: string) => {
  const probe = join(
    repositoryRoot,
    directory,
    `lint-probe-${randomUUID()}.ts`,
  );
  probeFiles.push(probe);
  writeFileSync(probe, source);

  return spawnSync(
    process.execPath,
    [
      oxlint,
      "--config",
      join(repositoryRoot, ".oxlintrc.json"),
      "--deny-warnings",
      "--format=default",
      probe,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
};

afterEach(() => {
  for (const probe of probeFiles.splice(0)) {
    rmSync(probe, { force: true });
  }
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

describe("engine import boundary probes", () => {
  it("keeps node: builtins out of the engine", () => {
    const result = runPackageLint(
      "packages/engine/src",
      'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("eslint(no-restricted-imports)");
    expect(result.stdout).toContain(
      "engine reaches the platform through Effect services",
    );
  });

  it("keeps bare builtin imports out of the engine", () => {
    const result = runPackageLint(
      "packages/engine/src",
      'import { readFileSync } from "fs";\nexport const read = readFileSync;\n',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("unicorn(prefer-node-protocol)");
  });

  it("keeps workspace packages out of the engine", () => {
    const result = runPackageLint(
      "packages/engine/src",
      'import { renderReportHtml } from "@codeheat/viewer";\nexport const render = renderReportHtml;\n',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("eslint(no-restricted-imports)");
    expect(result.stdout).toContain(
      "engine is the floor of the dependency graph",
    );
  });
});

describe("viewer import boundaries", () => {
  it("rejects an Effect import", () => {
    const result = runPackageLint(
      "packages/viewer/src",
      'import { Effect } from "effect";\nexport const probe = Effect;\n',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("viewer is plain browser code");
  });

  it("rejects a runtime import of the engine", () => {
    const result = runPackageLint(
      "packages/viewer/src",
      'import { analyze } from "@codeheat/engine";\nexport const probe = analyze;\n',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("viewer may import engine types only");
  });

  it("rejects an import of the CLI", () => {
    const result = runPackageLint(
      "packages/viewer/src",
      'import { cli } from "@codeheat/cli";\nexport const probe = cli;\n',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("viewer renders a Report");
  });

  it("allows a type import from the engine", () => {
    const result = runPackageLint(
      "packages/viewer/src",
      'import type { Report } from "@codeheat/engine";\nexport type Probe = Report;\n',
    );

    expect(result.stdout).not.toContain("no-restricted-imports");
    expect(result.status).toBe(0);
  });
});
