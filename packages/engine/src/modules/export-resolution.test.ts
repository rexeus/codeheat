import { describe, expect, it } from "vitest";

import type { SourceExports } from "../code/language-adapter.js";
import { resolveExport } from "./export-resolution.js";
import type { ExportWorld } from "./export-resolution.js";

type Binding = SourceExports["names"][number]["binding"];

/** What a file exports: names with their bindings, and the specifiers of its `export * from`. */
type Listing = {
  readonly names?: Readonly<Record<string, Binding>>;
  readonly forwarded?: ReadonlyArray<string>;
};

const local = (name: string): Binding => ({ local: name });
const taken = (specifier: string, name: string): Binding => ({
  specifier,
  name,
});

/**
 * A world written as data. Files and specifiers are the same strings, so a
 * file `./a` is reached by the specifier `./a`; `unloaded` files exist but were
 * not read, and any other specifier names no file.
 */
const worldOf = (
  listings: Readonly<Record<string, Listing>>,
  unloaded: ReadonlyArray<string> = [],
): ExportWorld => {
  const known = new Set([...Object.keys(listings), ...unloaded]);
  return {
    loaded: new Map(
      Object.entries(listings).map(([file, { names = {}, forwarded = [] }]) => [
        file,
        {
          names: Object.entries(names).map(([name, binding]) => ({
            name,
            binding,
          })),
          forwarded,
        },
      ]),
    ),
    fileOf: (_from, specifier) =>
      known.has(specifier) ? specifier : undefined,
  };
};

describe("resolveExport", () => {
  it("resolves a file's own export to the binding it declares, however the names differ", () => {
    const world = worldOf({
      "./index": { names: { x: local("a"), y: local("a") } },
    });

    expect(resolveExport(world, "./index", "x")).toStrictEqual({
      kind: "binding",
      id: "./index#a",
      exact: true,
    });
    expect(resolveExport(world, "./index", "y")).toStrictEqual(
      resolveExport(world, "./index", "x"),
    );
  });

  it("follows a named re-export to the file that declares the binding", () => {
    const world = worldOf({
      "./index": { names: { renamed: taken("./impl", "x") } },
      "./impl": { names: { x: local("x") } },
    });

    expect(resolveExport(world, "./index", "renamed")).toStrictEqual({
      kind: "binding",
      id: "./impl#x",
      exact: true,
    });
  });

  it("lets a file's own export win over the same name from export-star", () => {
    const world = worldOf({
      "./index": { names: { x: local("x") }, forwarded: ["./a"] },
      "./a": { names: { x: local("x") } },
    });

    expect(resolveExport(world, "./index", "x")).toMatchObject({
      id: "./index#x",
    });
  });
});

describe("resolveExport with several export-star sources", () => {
  it("calls a name ambiguous when two sources export different bindings of it", () => {
    const world = worldOf({
      "./index": { forwarded: ["./a", "./b"] },
      "./a": { names: { x: local("x") } },
      "./b": { names: { x: local("x") } },
    });

    expect(resolveExport(world, "./index", "x")).toStrictEqual({
      kind: "ambiguous",
    });
  });

  it("keeps ambiguity when it arises below another source that agrees", () => {
    const world = worldOf({
      "./index": { forwarded: ["./m", "./c"] },
      "./m": { forwarded: ["./a", "./b"] },
      "./a": { names: { x: local("x") } },
      "./b": { names: { x: local("x") } },
      "./c": { names: { x: local("x") } },
    });

    expect(resolveExport(world, "./index", "x")).toStrictEqual({
      kind: "ambiguous",
    });
  });

  it("resolves a name that two sources reach as one binding, by star and by name", () => {
    const world = worldOf({
      "./index": { forwarded: ["./left", "./right"] },
      "./left": { forwarded: ["./base"] },
      "./right": { names: { x: taken("./base", "x") } },
      "./base": { names: { x: local("x") } },
    });

    expect(resolveExport(world, "./index", "x")).toStrictEqual({
      kind: "binding",
      id: "./base#x",
      exact: true,
    });
  });
});

describe("resolveExport with a chain that was cut", () => {
  it("does not know whether two bindings differ when one chain was cut", () => {
    const world = worldOf(
      {
        "./index": { forwarded: ["./a", "./b"] },
        "./a": { names: { x: taken("./unread-a", "x") } },
        "./b": { names: { x: taken("./unread-b", "x") } },
      },
      ["./unread-a", "./unread-b"],
    );

    expect(resolveExport(world, "./index", "x")).toStrictEqual({
      kind: "unknown",
    });
  });

  it("still tells an exact binding from a cut one, and stays inexact when sources agree on a cut one", () => {
    const world = worldOf(
      {
        "./index": { forwarded: ["./m", "./c"] },
        "./m": { forwarded: ["./a", "./b"] },
        "./a": { names: { x: taken("./unread", "x") } },
        "./b": { names: { x: taken("./unread", "x") } },
        "./c": { names: { x: local("x") } },
      },
      ["./unread"],
    );

    expect(resolveExport(world, "./m", "x")).toStrictEqual({
      kind: "binding",
      id: "./unread#x",
      exact: false,
    });
    expect(resolveExport(world, "./index", "x")).toStrictEqual({
      kind: "unknown",
    });
  });

  it("does not know a name when one source cannot be followed, whatever the others say", () => {
    const world = worldOf({
      "./index": { forwarded: ["./a", "./nowhere"] },
      "./a": { names: { x: local("x") } },
    });

    expect(resolveExport(world, "./index", "x")).toStrictEqual({
      kind: "unknown",
    });
  });

  it("finds no such name when no source exports it", () => {
    const world = worldOf({
      "./index": { forwarded: ["./a"] },
      "./a": { names: { x: local("x") } },
    });

    expect(resolveExport(world, "./index", "y")).toStrictEqual({
      kind: "missing",
    });
  });
});

describe("resolveExport of default, cycles, and hops out of sight", () => {
  it("does not forward default through export-star, but resolves a file's own", () => {
    const world = worldOf({
      "./index": { forwarded: ["./a"] },
      "./a": { names: { default: local("*default*") } },
    });

    expect(resolveExport(world, "./index", "default")).toStrictEqual({
      kind: "missing",
    });
    expect(resolveExport(world, "./a", "default")).toMatchObject({
      kind: "binding",
    });
  });

  it("resolves a name through a cycle of export-star, and nothing else", () => {
    const world = worldOf({
      "./a": { forwarded: ["./b"] },
      "./b": { forwarded: ["./a"], names: { y: local("y") } },
    });

    expect(resolveExport(world, "./a", "y")).toMatchObject({
      id: "./b#y",
    });
    expect(resolveExport(world, "./a", "z")).toStrictEqual({
      kind: "missing",
    });
  });
});

describe("resolveExport of names out of sight", () => {
  it("gives a named re-export out of sight an inexact binding of its own", () => {
    const world = worldOf(
      {
        "./index": {
          names: {
            gone: taken("./missing", "gone"),
            unread: taken("./unread", "x"),
            ns: taken("./unread", "*"),
          },
        },
      },
      ["./unread"],
    );

    expect(resolveExport(world, "./index", "gone")).toStrictEqual({
      kind: "binding",
      id: "./index\0./missing#gone",
      exact: false,
    });
    expect(resolveExport(world, "./index", "unread")).toStrictEqual({
      kind: "binding",
      id: "./unread#x",
      exact: false,
    });
    expect(resolveExport(world, "./index", "ns")).toStrictEqual({
      kind: "binding",
      id: "./unread#*",
      exact: true,
    });
  });

  it("takes a name from a package as the same binding wherever it is written", () => {
    const world = worldOf({
      "./a": { names: { pad: taken("left-pad", "pad") } },
      "./b": { names: { padded: taken("left-pad", "pad") } },
    });

    expect(resolveExport(world, "./a", "pad")).toStrictEqual({
      kind: "binding",
      id: "ext:left-pad#pad",
      exact: true,
    });
    expect(resolveExport(world, "./b", "padded")).toStrictEqual(
      resolveExport(world, "./a", "pad"),
    );
  });
});

/** `x` reaches level 0 over `levels` diamonds, so the paths to it number 2^levels. */
const ladder = (levels: number): ExportWorld => {
  const listings: Record<string, Listing> = {
    [`./n${levels}`]: { names: { x: local("x") } },
  };
  for (let level = 0; level < levels; level++) {
    listings[`./n${level}`] = { forwarded: [`./a${level}`, `./b${level}`] };
    listings[`./a${level}`] = { forwarded: [`./n${level + 1}`] };
    listings[`./b${level}`] = { forwarded: [`./n${level + 1}`] };
  }
  return worldOf(listings);
};

describe("resolveExport cost", () => {
  it("resolves a name behind a ladder of twenty diamonds at once", () => {
    const started = performance.now();

    const resolved = resolveExport(ladder(20), "./n0", "x");

    expect(resolved).toStrictEqual({
      kind: "binding",
      id: "./n20#x",
      exact: true,
    });
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("resolves a name through a clique of export-star at once", () => {
    const files = Array.from({ length: 12 }, (_, index) => `./f${index}`);
    const listings: Record<string, Listing> = {};
    for (const file of files) {
      listings[file] = { forwarded: files.filter((other) => other !== file) };
    }
    listings["./f11"] = {
      forwarded: files.slice(0, 11),
      names: { x: local("x") },
    };
    const world = worldOf(listings);
    const started = performance.now();

    const resolved = resolveExport(world, "./f0", "x");

    expect(resolved).toMatchObject({ kind: "binding", id: "./f11#x" });
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
