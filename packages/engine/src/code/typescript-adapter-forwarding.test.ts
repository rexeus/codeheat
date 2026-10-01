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
});

describe("typescript adapter imports inside exported expressions", () => {
  it("does not count an import that an exported function only uses", () => {
    const found = read(
      "use.ts",
      "import run from './run';\nexport function f() { return run(); }\nexport const g = () => run();\n",
    );

    expect(found?.reexports).toStrictEqual([]);
    expect(found?.imports).toStrictEqual(["./run"]);
  });

  it("counts an import inside the initializer of an exported variable", () => {
    const found = read(
      "api.ts",
      "import { run } from './b';\nexport const api = { run };\n",
    );

    expect(found?.reexports).toStrictEqual(["./b"]);
  });

  it("follows a name to the variable it exports", () => {
    const byDefault = read(
      "a.ts",
      "import { run } from './b';\nconst api = { run };\nexport default api;\n",
    );
    const byName = read(
      "c.ts",
      "import a from './a';\nconst k = a;\nexport { k };\n",
    );

    expect(byDefault?.reexports).toStrictEqual(["./b"]);
    expect(byName?.reexports).toStrictEqual(["./a"]);
  });

  it("counts an import inside a default-exported expression, and only that import", () => {
    const found = read(
      "preset.ts",
      "import x from './x';\nimport y from './y';\nexport default { x };\n",
    );

    expect(found?.reexports).toStrictEqual(["./x"]);
    expect(found?.imports).toStrictEqual(["./x", "./y"]);
  });

  it("counts a dynamic import inside an exported route table of a JavaScript file", () => {
    const found = read(
      "routes.js",
      "export default [{ path: '/', load: () => import('./Page') }];\n",
    );

    expect(found?.reexports).toStrictEqual(["./Page"]);
  });

  it("counts a dynamic import inside an exported route table", () => {
    const found = read(
      "routes.ts",
      "export default [{ path: '/', load: () => import('./Page') }];\n",
    );

    expect(found?.reexports).toStrictEqual(["./Page"]);
  });

  it("leaves a default-exported class or function that is named alone", () => {
    const found = read(
      "view.ts",
      "import a from './a';\nexport default class View { a = a }\n",
    );

    expect(found?.reexports).toStrictEqual([]);
  });
});

describe("typescript adapter keeps export-from next to other exports", () => {
  it("keeps export * from when the file also exports a default object", () => {
    const found = read(
      "a.ts",
      "export * from './b';\nexport default { version: 1 };\n",
    );

    expect(found?.reexports).toStrictEqual(["./b"]);
  });

  it("keeps a named export-from when the file also exports a default function", () => {
    const found = read(
      "a.ts",
      "export { v } from './b';\nexport default function () {}\n",
    );

    expect(found?.reexports).toStrictEqual(["./b"]);
  });

  it("keeps export-from when a CommonJS-style assignment follows", () => {
    const found = read(
      "a.js",
      "export { v } from './b.js';\nexports.extra = 1;\n",
    );

    expect(found?.reexports).toStrictEqual(["./b.js"]);
  });

  it("adds what is handed on to the export-from modules", () => {
    const found = read(
      "a.ts",
      "import { run } from './c';\nexport * from './b';\nexport default { run };\n",
    );

    expect(found?.reexports.toSorted()).toStrictEqual(["./b", "./c"]);
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

  it("follows a required name to what module.exports is assigned", () => {
    const found = read(
      "lib.js",
      "const a = require('./a');\nmodule.exports = { ...a };\n",
    );

    expect(found?.reexports).toStrictEqual(["./a"]);
  });

  it("does not count requires that module.exports only calls", () => {
    const found = read(
      "lib.js",
      "const run = require('./run');\nmodule.exports = function () { return run(); };\n",
    );

    expect(found?.reexports).toStrictEqual([]);
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

describe("typescript adapter canReexport for loaders", () => {
  it("is true for files that load modules by expression and export them", () => {
    for (const source of [
      "export default import.meta.glob('./pages/*.ts', { eager: true });",
      "module.exports = require.context('./icons');",
      "export default [{ load: () => import('./Page') }];",
      "export const worker = new URL('./w.ts', import.meta.url);",
      "__export(require('./t'));",
    ]) {
      expect(adapter.canReexport(source)).toBe(true);
    }
  });
});

describe("typescript adapter wide trees", () => {
  it("reads a file with an array of two hundred thousand elements", () => {
    const wide = `export const numbers = [${Array.from({ length: 200_000 }, () => "1").join(",")}];\nimport x from './x';\nexport default { x };\n`;

    expect(read("wide.ts", wide)?.reexports).toStrictEqual(["./x"]);
  });
});
