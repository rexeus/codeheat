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

  it("cuts at the top level when no depth splits the files", () => {
    const files = ["scripts/release.ts", "scripts/lib/util.ts"];

    expect(moduleOf(files)).toStrictEqual({
      "scripts/release.ts": "directory:scripts",
      "scripts/lib/util.ts": "directory:scripts",
    });
  });

  it("keeps one module per top-level directory when nothing below splits", () => {
    const files = ["src/index.ts", "src/internal/helpers/deep.ts"];

    expect(moduleOf(files)).toStrictEqual({
      "src/index.ts": "directory:src",
      "src/internal/helpers/deep.ts": "directory:src",
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

/** `count` files `<directory>/f0.ts`, `<directory>/f1.ts`, … */
const filesIn = (directory: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

/** The distinct modules of the files, as `kind:path`. */
const modulesOf = (
  files: ReadonlyArray<string>,
  packages: ReadonlyArray<string> = [],
): ReadonlySet<string> => new Set(Object.values(moduleOf(files, packages)));

describe("detectModules splits a module that holds most of the files", () => {
  it("splits the only package when a small directory sits beside it", () => {
    const files = [
      ...filesIn("packages/app/src/billing", 20),
      ...filesIn("packages/app/src/auth", 20),
      ...filesIn("packages/app/src/orders", 10),
      ...filesIn("scripts", 3),
    ];

    expect(modulesOf(files, ["packages/app"])).toStrictEqual(
      new Set([
        "directory:packages/app/src/billing",
        "directory:packages/app/src/auth",
        "directory:packages/app/src/orders",
        "directory:scripts",
      ]),
    );
  });

  it("splits a directory module that holds most of the files", () => {
    const files = [
      ...filesIn("src/billing", 30),
      ...filesIn("src/auth", 30),
      ...filesIn("test", 10),
    ];

    expect(modulesOf(files)).toStrictEqual(
      new Set([
        "directory:src/billing",
        "directory:src/auth",
        "directory:test",
      ]),
    );
  });
});

describe("detectModules splits a dominant directory module further", () => {
  it("splits a directory module that sits beside small packages", () => {
    const files = [
      ...filesIn("src/billing", 20),
      ...filesIn("src/auth", 20),
      ...filesIn("scripts", 1),
      ...filesIn("packages/a", 2),
      ...filesIn("packages/b", 2),
    ];

    expect(modulesOf(files, ["packages/a", "packages/b"])).toStrictEqual(
      new Set([
        "directory:src/billing",
        "directory:src/auth",
        "directory:scripts",
        "package:packages/a",
        "package:packages/b",
      ]),
    );
  });

  it("splits again while a part still holds most of the files", () => {
    const files = [
      "src/index.ts",
      ...filesIn("src/core/parse", 30),
      ...filesIn("src/core/emit", 30),
      ...filesIn("test", 3),
    ];

    expect(modulesOf(files)).toStrictEqual(
      new Set([
        "directory:src",
        "directory:src/core/parse",
        "directory:src/core/emit",
        "directory:test",
      ]),
    );
  });
});

describe("detectModules keeps a module that holds most of the files", () => {
  it("keeps a package that is the largest of several", () => {
    const files = [
      ...filesIn("packages/core/src/parse", 70),
      ...filesIn("packages/core/src/emit", 70),
      ...filesIn("packages/cli/src", 5),
      ...filesIn("scripts", 3),
    ];

    expect(modulesOf(files, ["packages/core", "packages/cli"])).toStrictEqual(
      new Set([
        "package:packages/core",
        "package:packages/cli",
        "directory:scripts",
      ]),
    );
  });

  it("keeps the larger of two packages even when it holds nearly everything", () => {
    const files = [
      ...filesIn("packages/core/src", 95),
      ...filesIn("packages/cli", 5),
    ];

    expect(modulesOf(files, ["packages/core", "packages/cli"])).toStrictEqual(
      new Set(["package:packages/core", "package:packages/cli"]),
    );
  });

  it("keeps a module that has no directories to split by", () => {
    const files = [...filesIn("lib", 29), ...filesIn("scripts", 1)];

    expect(modulesOf(files)).toStrictEqual(
      new Set(["directory:lib", "directory:scripts"]),
    );
  });

  it("keeps the only package when its files cannot be split", () => {
    const files = [...filesIn("tool/src", 29), ...filesIn("scripts", 1)];

    expect(modulesOf(files, ["tool"])).toStrictEqual(
      new Set(["package:tool", "directory:scripts"]),
    );
  });
});

/** `inSrc` files below `src` in two directories, `outside` files in `tools`. */
const modulesWith = (inSrc: number, outside: number) =>
  modulesOf([
    ...filesIn("src/billing", Math.ceil(inSrc / 2)),
    ...filesIn("src/auth", Math.floor(inSrc / 2)),
    ...filesIn("tools", outside),
  ]);

describe("detectModules at the share that makes a module dominant", () => {
  it("keeps a module that holds exactly 70 % of the files", () => {
    expect(modulesWith(70, 30)).toStrictEqual(
      new Set(["directory:src", "directory:tools"]),
    );
  });

  it("splits a module that holds more than 70 % of the files", () => {
    expect(modulesWith(71, 29)).toStrictEqual(
      new Set([
        "directory:src/billing",
        "directory:src/auth",
        "directory:tools",
      ]),
    );
  });
});

/** A package of two directories with `inPackage` files, and a script. */
const modulesWithPackage = (inPackage: number) =>
  modulesOf(
    [
      ...filesIn("app/src/billing", Math.ceil(inPackage / 2)),
      ...filesIn("app/src/auth", Math.floor(inPackage / 2)),
      ...filesIn("scripts", 1),
    ],
    ["app"],
  );

describe("detectModules leaves small and declared modules alone", () => {
  it("keeps a module of 19 files, however large its share", () => {
    expect(modulesWithPackage(19)).toStrictEqual(
      new Set(["package:app", "directory:scripts"]),
    );
  });

  it("splits a module of 20 files that holds more than the share", () => {
    expect(modulesWithPackage(20)).toStrictEqual(
      new Set([
        "directory:app/src/billing",
        "directory:app/src/auth",
        "directory:scripts",
      ]),
    );
  });

  it("keeps a repository of ten files as it was", () => {
    const files = [
      ...filesIn("src/a", 5),
      ...filesIn("src/b", 4),
      "tools/x.ts",
    ];

    expect(modulesOf(files)).toStrictEqual(
      new Set(["directory:src", "directory:tools"]),
    );
  });

  it("splits the only package although a package of test code alone sits beside it", () => {
    const files = [
      ...filesIn("app/src/billing", 15),
      ...filesIn("app/src/auth", 15),
      ...filesIn("test/fixtures/sample", 1),
    ];

    expect(modulesOf(files, ["app", "test/fixtures/sample"])).toStrictEqual(
      new Set([
        "directory:app/src/billing",
        "directory:app/src/auth",
        "package:test/fixtures/sample",
      ]),
    );
  });

  it("keeps a package beside a package that has code outside test directories", () => {
    const files = [
      ...filesIn("app/src/billing", 15),
      ...filesIn("app/src/auth", 15),
      ...filesIn("tools/fmt", 1),
    ];

    expect(modulesOf(files, ["app", "tools/fmt"])).toStrictEqual(
      new Set(["package:app", "package:tools/fmt"]),
    );
  });
});
