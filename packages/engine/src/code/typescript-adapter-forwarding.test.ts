import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { typescriptAdapter } from "./typescript-adapter.js";

const adapter = typescriptAdapter(parseSync);
const read = (file: string, source: string) => adapter.imports(file, source);

describe("typescript adapter re-exports of imported bindings", () => {
  it("counts an imported binding that is exported as the default as re-exported", () => {
    const found = read(
      "Button.ts",
      "import Button from './Button';\nexport default Button;\n",
    );

    expect(found?.reexports).toStrictEqual(["./Button"]);
  });

  it("counts an imported namespace that is exported as re-exported", () => {
    const found = read(
      "index.ts",
      "import * as math from './math';\nexport { math };\n",
    );

    expect(found?.reexports).toStrictEqual(["./math"]);
  });

  it("does not count an import that is only used", () => {
    const found = read(
      "use.ts",
      "import a from './a';\nconst k = a;\nexport { k };\n",
    );

    expect(found?.reexports).toStrictEqual([]);
    expect(found?.imports).toStrictEqual(["./a"]);
  });

  it("counts everything a default-exported expression may hand on", () => {
    const found = read(
      "preset.ts",
      "import x from './x';\nimport y from './y';\nexport default { x };\n",
    );

    expect(found?.reexports).toStrictEqual(["./x", "./y"]);
  });

  it("leaves a default-exported class or function that is named alone", () => {
    const found = read(
      "view.ts",
      "import a from './a';\nexport default class View { a = a }\n",
    );

    expect(found?.reexports).toStrictEqual([]);
  });
});

describe("typescript adapter CommonJS barrels", () => {
  it("counts what a file requires as re-exported when it assigns module.exports", () => {
    const found = read(
      "index.js",
      "module.exports = { a: require('./a'), b: require('./b') };\n",
    );

    expect(found?.reexports.toSorted()).toStrictEqual(["./a", "./b"]);
  });

  it("does the same for exports.x and for module.exports.x", () => {
    const first = read("a.js", "exports.a = require('./a');\n");
    const second = read("b.js", "module.exports.b = require('./b');\n");

    expect(first?.reexports).toStrictEqual(["./a"]);
    expect(second?.reexports).toStrictEqual(["./b"]);
  });

  it("does the same for export = in TypeScript", () => {
    const found = read(
      "legacy.ts",
      "import legacy = require('./legacy');\nexport = legacy;\n",
    );

    expect(found?.reexports).toStrictEqual(["./legacy"]);
  });

  it("does not count requires of a file that exports nothing", () => {
    const found = read(
      "script.js",
      "const a = require('./a');\nconsole.log(a);\n",
    );

    expect(found?.reexports).toStrictEqual([]);
    expect(found?.imports).toStrictEqual(["./a"]);
  });
});

describe("typescript adapter bundler loaders", () => {
  it("marks import.meta.glob and require.context as loading modules by expression", () => {
    const glob = read(
      "a.ts",
      "export const pages = import.meta.glob('./pages/*.ts');\n",
    );
    const context = read(
      "b.js",
      "const all = require.context('./icons', true);\nmodule.exports = all;\n",
    );

    expect(glob?.computed).toBe(true);
    expect(context?.computed).toBe(true);
  });

  it("reads new URL of a literal with import.meta.url as an import of that file", () => {
    const found = read(
      "main.ts",
      "export const worker = new Worker(new URL('./worker.ts', import.meta.url));\n",
    );

    expect(found?.imports).toStrictEqual(["./worker.ts"]);
    expect(found?.computed).toBe(false);
  });

  it("marks new URL of a computed path with import.meta.url as computed", () => {
    const found = read(
      "main.ts",
      "export const load = (name: string) => new URL(name, import.meta.url);\n",
    );

    expect(found?.computed).toBe(true);
  });

  it("leaves an ordinary URL alone", () => {
    const found = read(
      "main.ts",
      "export const home = new URL('https://example.com');\n",
    );

    expect(found?.imports).toStrictEqual([]);
    expect(found?.computed).toBe(false);
  });
});
