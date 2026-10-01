import { describe, expect, it } from "vitest";

import { detectModules } from "./detect.js";

/** The kind and path of every file's module. */
const moduleOf = (
  files: ReadonlyArray<string>,
  packages: ReadonlyArray<string> = [],
) =>
  Object.fromEntries(
    [...detectModules(files, new Set(packages))].map(([file, module]) => [
      file,
      `${module.kind}:${module.path}`,
    ]),
  );

describe("detectModules with packages", () => {
  it("assigns files of pnpm-style packages and apps to their package", () => {
    const files = [
      "packages/billing/src/invoice.ts",
      "packages/billing/src/tax.ts",
      "packages/auth/src/session.ts",
      "apps/cli/src/bin.ts",
    ];

    expect(
      moduleOf(files, ["packages/billing", "packages/auth", "apps/cli"]),
    ).toStrictEqual({
      "packages/billing/src/invoice.ts": "package:packages/billing",
      "packages/billing/src/tax.ts": "package:packages/billing",
      "packages/auth/src/session.ts": "package:packages/auth",
      "apps/cli/src/bin.ts": "package:apps/cli",
    });
  });

  it("treats a Go module inside a repository as one package", () => {
    const files = [
      "services/payments/main.go",
      "services/payments/pay/pay.go",
      "web/app.ts",
    ];

    expect(moduleOf(files, ["services/payments", "web"])).toStrictEqual({
      "services/payments/main.go": "package:services/payments",
      "services/payments/pay/pay.go": "package:services/payments",
      "web/app.ts": "package:web",
    });
  });

  it("lets the nearest enclosing package win", () => {
    const files = [
      "packages/ui/index.ts",
      "packages/ui/native/button.ts",
      "packages/core/index.ts",
    ];

    expect(
      moduleOf(files, ["packages/ui", "packages/ui/native", "packages/core"]),
    ).toStrictEqual({
      "packages/ui/index.ts": "package:packages/ui",
      "packages/ui/native/button.ts": "package:packages/ui/native",
      "packages/core/index.ts": "package:packages/core",
    });
  });

  it("groups files outside every package by directory next to the packages", () => {
    const files = [
      "packages/a/x.ts",
      "packages/b/y.ts",
      "scripts/release.ts",
      "setup.ts",
    ];

    expect(moduleOf(files, ["packages/a", "packages/b"])).toStrictEqual({
      "packages/a/x.ts": "package:packages/a",
      "packages/b/y.ts": "package:packages/b",
      "scripts/release.ts": "directory:scripts",
      "setup.ts": "directory:.",
    });
  });
});

describe("detectModules without packages", () => {
  it("descends a lone src directory to the first depth that splits", () => {
    const files = [
      "src/billing/invoice.ts",
      "src/billing/tax.ts",
      "src/auth/session.ts",
    ];

    expect(moduleOf(files)).toStrictEqual({
      "src/billing/invoice.ts": "directory:src/billing",
      "src/billing/tax.ts": "directory:src/billing",
      "src/auth/session.ts": "directory:src/auth",
    });
  });

  it("keeps a file above the cut-off depth in its own directory", () => {
    const files = ["src/index.ts", "src/a/x.ts", "src/b/y.ts"];

    expect(moduleOf(files)).toStrictEqual({
      "src/index.ts": "directory:src",
      "src/a/x.ts": "directory:src/a",
      "src/b/y.ts": "directory:src/b",
    });
  });

  it("puts root files in module . without letting them stop the descent", () => {
    const files = ["index.ts", "lib/a/x.ts", "lib/b/y.ts"];

    expect(moduleOf(files)).toStrictEqual({
      "index.ts": "directory:.",
      "lib/a/x.ts": "directory:lib/a",
      "lib/b/y.ts": "directory:lib/b",
    });
  });

  it("splits at the first directory level when it already differs", () => {
    const files = ["apps/a/x.ts", "libs/b/y.ts"];

    expect(moduleOf(files)).toStrictEqual({
      "apps/a/x.ts": "directory:apps",
      "libs/b/y.ts": "directory:libs",
    });
  });

  it("keeps a repository of root files in one module", () => {
    expect(moduleOf(["a.ts", "b.ts"])).toStrictEqual({
      "a.ts": "directory:.",
      "b.ts": "directory:.",
    });
  });

  it("detects no module in an empty universe", () => {
    expect(moduleOf([])).toStrictEqual({});
  });
});

describe("detectModules in a single-package repository", () => {
  it("splits the only package by directory", () => {
    const files = [
      "packages/app/src/billing/invoice.ts",
      "packages/app/src/auth/session.ts",
      "packages/app/index.ts",
    ];

    expect(moduleOf(files, ["packages/app"])).toStrictEqual({
      "packages/app/src/billing/invoice.ts":
        "directory:packages/app/src/billing",
      "packages/app/src/auth/session.ts": "directory:packages/app/src/auth",
      "packages/app/index.ts": "directory:packages/app",
    });
  });

  it("keeps a lone package whose files cannot be split", () => {
    expect(moduleOf(["lib/a.ts", "lib/b.ts"], ["lib"])).toStrictEqual({
      "lib/a.ts": "directory:lib",
      "lib/b.ts": "directory:lib",
    });
  });
});
