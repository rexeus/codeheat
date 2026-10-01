import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { typescriptAdapter } from "./typescript-adapter.js";

const adapter = typescriptAdapter(parseSync);
const handedOn = (file: string, source: string) =>
  adapter.imports(file, source)?.reexports.toSorted();

describe("typescript adapter assignments to top-level names", () => {
  it("hands on what is assigned to a member of an exported name", () => {
    expect(
      handedOn(
        "Form.tsx",
        "import InternalForm from './Form';\nimport Item from './Item';\nconst Form = InternalForm as C;\nForm.Item = Item;\nexport default Form;\n",
      ),
    ).toStrictEqual(["./Form", "./Item"]);
    expect(
      handedOn(
        "Button.ts",
        "import Button from './B';\nimport Group from './G';\nButton.Group = Group;\nexport default Button;\n",
      ),
    ).toStrictEqual(["./B", "./G"]);
  });

  it("hands on what is assigned inside try, if and blocks at the top level", () => {
    expect(
      handedOn(
        "lib.js",
        "let impl;\ntry { impl = require('./t'); } catch (e) { impl = null; }\nmodule.exports = impl;\n",
      ),
    ).toStrictEqual(["./t"]);
    expect(
      handedOn(
        "lib.js",
        "let impl;\nif (process.env.X) { impl = require('./a'); } else { impl = require('./b'); }\nmodule.exports = impl;\n",
      ),
    ).toStrictEqual(["./a", "./b"]);
  });

  it("hands on what is assigned later to an exported variable", () => {
    expect(
      handedOn(
        "a.ts",
        "import { run } from './r';\nexport let current = null;\ncurrent = run;\n",
      ),
    ).toStrictEqual(["./r"]);
  });

  it("ignores assignments inside functions", () => {
    expect(
      handedOn(
        "a.ts",
        "import { run } from './r';\nconst o = {};\nfunction setup() { o.run = run; }\nexport default o;\n",
      ),
    ).toStrictEqual([]);
  });
});

describe("typescript adapter hoisted functions", () => {
  it("binds a function declared below the code that names it", () => {
    expect(
      handedOn(
        "routes.ts",
        "const routes = [{ load: loadHome }];\nexport default routes;\nfunction loadHome() { return import('./t'); }\n",
      ),
    ).toStrictEqual(["./t"]);
  });
});

describe("typescript adapter calls that fill the exports", () => {
  it("hands on what Object.assign puts on module.exports or exports", () => {
    expect(
      handedOn("a.js", "Object.assign(module.exports, require('./t'));\n"),
    ).toStrictEqual(["./t"]);
    expect(
      handedOn("a.js", "Object.assign(exports, require('./t'));\n"),
    ).toStrictEqual(["./t"]);
  });

  it("hands on what tsc's export helpers put on the exports", () => {
    expect(
      handedOn("a.js", "__exportStar(require('./t'), exports);\n"),
    ).toStrictEqual(["./t"]);
    expect(handedOn("a.js", "__export(require('./t'));\n")).toStrictEqual([
      "./t",
    ]);
    expect(
      handedOn("a.js", "tslib_1.__exportStar(require('./t'), exports);\n"),
    ).toStrictEqual(["./t"]);
  });

  it("does not hand on what Object.assign puts on another object", () => {
    expect(
      handedOn(
        "a.js",
        "const o = {};\nObject.assign(o, require('./t'));\nmodule.exports = 1;\n",
      ),
    ).toStrictEqual([]);
  });
});

describe("typescript adapter decorators and implements", () => {
  it("hands on what a class decorator names, which runs at the definition", () => {
    expect(
      handedOn(
        "parent.ts",
        "import { Component } from './core';\nimport { Child } from './child';\n@Component({ imports: [Child] })\nexport class Parent {}\n",
      ),
    ).toContain("./child");
  });

  it("does not hand on an interface that a class implements", () => {
    expect(
      handedOn(
        "p.ts",
        "import type { I } from './i';\nexport class P implements I {}\n",
      ),
    ).toStrictEqual([]);
  });
});

describe("typescript adapter members assigned to exported functions", () => {
  it("hands on what is assigned to a default-exported function", () => {
    expect(
      handedOn(
        "Card.tsx",
        "import Header from './t.js';\nexport default function Card() { return <div />; }\nCard.Header = Header;\n",
      ),
    ).toStrictEqual(["./t.js"]);
  });

  it("hands on what is assigned to a named exported function", () => {
    expect(
      handedOn(
        "Card.tsx",
        "import Header from './t.js';\nexport function Card() { return null; }\nCard.Header = Header;\n",
      ),
    ).toStrictEqual(["./t.js"]);
  });

  it("hands on a loader assigned to an exported async function", () => {
    expect(
      handedOn(
        "load.ts",
        "export default async function load() {}\nload.page = () => import('./t.js');\n",
      ),
    ).toStrictEqual(["./t.js"]);
  });

  it("hands on what is assigned to an exported class", () => {
    expect(
      handedOn(
        "K.ts",
        "import Header from './t.js';\nexport class K {}\nK.Header = Header;\n",
      ),
    ).toStrictEqual(["./t.js"]);
  });
});

describe("typescript adapter destructuring assignments", () => {
  it("hands on what an object pattern at the top level is assigned", () => {
    expect(
      handedOn(
        "lib.js",
        "let a;\n({ a } = require('./t'));\nmodule.exports = { a };\n",
      ),
    ).toStrictEqual(["./t"]);
  });

  it("hands on what an array pattern, a rest element, and a member target are assigned", () => {
    expect(
      handedOn(
        "lib.js",
        "let a;\n[a] = [require('./t')];\nmodule.exports = { a };\n",
      ),
    ).toStrictEqual(["./t"]);
    expect(
      handedOn(
        "lib.js",
        "let a, rest;\n({ a, ...rest } = require('./t'));\nmodule.exports = rest;\n",
      ),
    ).toStrictEqual(["./t"]);
    expect(
      handedOn(
        "lib.js",
        "const o = {};\n({ x: o.x } = require('./t'));\nmodule.exports = o;\n",
      ),
    ).toStrictEqual(["./t"]);
  });
});

describe("typescript adapter many assignments", () => {
  it("reads twenty thousand exports assigned from requires without slowing down", () => {
    const source = Array.from(
      { length: 20_000 },
      (_, index) => `exports.a${index} = require('./m${index}');`,
    ).join("\n");

    const found = handedOn("big.js", source);

    expect(found).toHaveLength(20_000);
  }, 5000);
});
