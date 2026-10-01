import { describe, expect, it } from "vitest";

import { createResolver } from "./resolve.js";
import type { ResolveWorld } from "./resolve.js";

/** A repository whose tracked files are `tracked`; the universe holds the TypeScript files among them. */
const resolverFor = (
  tracked: ReadonlyArray<string>,
  rest: Partial<ResolveWorld> = {},
) =>
  createResolver({
    universe: new Set(tracked.filter((file) => file.endsWith(".ts"))),
    tracked: new Set(tracked),
    packages: new Map(),
    ambiguous: new Set(),
    dependencies: new Set(),
    ...rest,
  });

describe("specifiers that are accounted for", () => {
  const resolve = resolverFor(
    ["src/a.ts", "src/style.css", "src/data.json", "src/icon.svg"],
    { dependencies: new Set(["react", "@scope/ui", "@types/lodash"]) },
  );

  it("accounts for a file in the universe", () => {
    expect(resolve("src/main.ts", "./a")).toStrictEqual({
      files: ["src/a.ts"],
      resolved: true,
    });
  });

  it("accounts for a tracked asset without following it, also with a bundler query", () => {
    const accounted = { files: [], resolved: true };

    expect(resolve("src/main.ts", "./style.css")).toStrictEqual(accounted);
    expect(resolve("src/main.ts", "./data.json")).toStrictEqual(accounted);
    expect(resolve("src/main.ts", "./icon.svg?url")).toStrictEqual(accounted);
  });

  it("accounts for Node built-ins, bare and prefixed, also with a subpath", () => {
    for (const specifier of ["fs", "node:test", "fs/promises", "node:path"]) {
      expect(resolve("src/main.ts", specifier).resolved).toBe(true);
    }
  });

  it("accounts for a dependency a manifest declares, with a subpath, and for one only its types declare", () => {
    for (const specifier of [
      "react",
      "react/jsx-runtime",
      "@scope/ui/button",
      "lodash",
    ]) {
      expect(resolve("src/main.ts", specifier)).toStrictEqual({
        files: [],
        resolved: true,
      });
    }
  });

  it("accounts for imports a runtime or registry resolves by protocol", () => {
    expect(resolve("src/main.ts", "npm:left-pad").resolved).toBe(true);
    expect(resolve("src/main.ts", "https://esm.sh/x").resolved).toBe(true);
  });
});

describe("specifiers that are not accounted for", () => {
  const resolve = resolverFor(["src/a.ts", "dist/b.ts", "src/b.d.ts"], {
    universe: new Set(["src/a.ts"]),
    dependencies: new Set(["react"]),
  });

  it("does not account for aliases that only a bundler or tsconfig knows", () => {
    for (const specifier of [
      "@/components/button",
      "~/util",
      "#internal/db",
      "src/a",
      "$lib/x",
    ]) {
      expect(resolve("src/main.ts", specifier)).toStrictEqual({
        files: [],
        resolved: false,
      });
    }
  });

  it("does not account for a scheme that a bundler plugin owns", () => {
    for (const specifier of [
      "virtual:pwa-register",
      "astro:content",
      "data:text/javascript,1",
    ]) {
      expect(resolve("src/main.ts", specifier).resolved).toBe(false);
    }
  });

  it("does not account for an undeclared package", () => {
    expect(resolve("src/main.ts", "left-pad").resolved).toBe(false);
  });

  it("does not account for a relative import of code outside the universe", () => {
    expect(resolve("src/main.ts", "../dist/b").resolved).toBe(false);
    expect(resolve("src/main.ts", "./b").resolved).toBe(false);
  });

  it("does not account for a relative import that names nothing", () => {
    expect(resolve("src/main.ts", "./missing").resolved).toBe(false);
    expect(resolve("src/main.ts", "../../escape").resolved).toBe(false);
    expect(resolve("src/main.ts", "./style.css").resolved).toBe(false);
  });
});

describe("workspace package names that are not accounted for", () => {
  it("does not account for a package name that two workspace packages claim", () => {
    const duplicated = resolverFor(["src/a.ts"], {
      packages: new Map([
        ["@acme/dup", { directory: "pkg", entryPoints: ["pkg/index.ts"] }],
      ]),
      ambiguous: new Set(["@acme/dup"]),
      dependencies: new Set(["@acme/dup"]),
    });

    expect(duplicated("src/a.ts", "@acme/dup")).toStrictEqual({
      files: [],
      resolved: false,
    });
  });

  it("does not account for a workspace package without entry points", () => {
    const empty = resolverFor(["src/a.ts"], {
      packages: new Map([
        ["@acme/empty", { directory: "pkg", entryPoints: [] }],
      ]),
    });

    expect(empty("src/a.ts", "@acme/empty").resolved).toBe(false);
  });
});

describe("names that could mean Node built-ins or local code", () => {
  const resolve = resolverFor([
    "src/constants/index.ts",
    "src/events.ts",
    "src/a.ts",
    "src/Comp.vue",
    "src/Page.svelte",
  ]);

  it("accounts for a built-in that no file or directory of the repository is named after", () => {
    expect(resolve("src/a.ts", "fs").resolved).toBe(true);
    expect(resolve("src/a.ts", "fs/promises").resolved).toBe(true);
    expect(resolve("src/a.ts", "node:events").resolved).toBe(true);
  });

  it("does not account for a built-in name that a directory or a file also carries", () => {
    expect(resolve("src/a.ts", "constants").resolved).toBe(false);
    expect(resolve("src/a.ts", "events").resolved).toBe(false);
  });

  it("does not take a component file for an asset, even though it is tracked", () => {
    expect(resolve("src/a.ts", "./Comp.vue").resolved).toBe(false);
    expect(resolve("src/a.ts", "./Page.svelte").resolved).toBe(false);
  });
});
