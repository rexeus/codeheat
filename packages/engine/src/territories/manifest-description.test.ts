import { describe, expect, it } from "vitest";

import { manifestDescription } from "./manifest-description.js";

describe("manifestDescription", () => {
  it("reads the description of the manifests that declare one", () => {
    expect([
      manifestDescription("package.json", '{ "description": "Invoices." }'),
      manifestDescription(
        "Cargo.toml",
        '[package]\nname = "x"\ndescription = "Fast \\"parser\\"."\n',
      ),
      manifestDescription(
        "pyproject.toml",
        "[project]\ndescription = 'Tax rules'\n",
      ),
      manifestDescription(
        "pom.xml",
        "<project><description>Billing</description></project>",
      ),
    ]).toStrictEqual(["Invoices.", 'Fast "parser".', "Tax rules", "Billing"]);
  });

  it("reads nothing from a malformed manifest or a description that is not text", () => {
    expect([
      manifestDescription("package.json", "{ nope"),
      manifestDescription("package.json", '{ "description": 3 }'),
      manifestDescription("package.json", "[]"),
      manifestDescription("go.mod", "module x"),
    ]).toStrictEqual([undefined, undefined, undefined, undefined]);
  });
});

const pom = (body: string): string | undefined =>
  manifestDescription(
    "pom.xml",
    `<?xml version="1.0"?>\n<project>${body}</project>`,
  );

describe("manifestDescription of a pom.xml", () => {
  it("takes the project's own description, not the parent's, a plugin's, or a comment's", () => {
    expect(
      pom(
        [
          "<!-- <description>from a comment</description> -->",
          "<parent><description>the parent</description></parent>",
          "<description>The &lt;billing&gt; service &amp; its &#x41;PI</description>",
          "<build><plugins><plugin><description>a plugin</description></plugin></plugins></build>",
        ].join("\n"),
      ),
    ).toBe("The <billing> service & its API");
  });

  it("reads nothing when only a nested element has a description", () => {
    expect(pom("<parent><description>the parent</description></parent>")).toBe(
      undefined,
    );
  });

  it("reads nothing from an empty top-level description, not a nested one's text", () => {
    expect(
      pom(
        "<description/><build><plugins><plugin><configuration><description>plugin text</description></configuration></plugin></plugins></build>",
      ),
    ).toBe(undefined);
  });

  it("unwraps character data", () => {
    expect(pom("<description><![CDATA[Fast & <small>]]></description>")).toBe(
      "Fast & <small>",
    );
  });
});

describe("manifestDescription of a TOML manifest", () => {
  it("reads a description in several lines", () => {
    expect(
      manifestDescription(
        "pyproject.toml",
        '[project]\nname = "x"\ndescription = """\nBills customers \\\n  and sends reminders.\n"""\n',
      ),
    ).toBe("Bills customers and sends reminders.\n");
    expect(
      manifestDescription(
        "Cargo.toml",
        "[package]\ndescription = '''\nA \"literal\" text\n'''\n",
      ),
    ).toBe('A "literal" text\n');
  });

  it("reads only the table that describes the package", () => {
    expect(
      manifestDescription(
        "Cargo.toml",
        '[dependencies.x]\ndescription = "a dependency"\n\n[package]\nname = "y"\ndescription = "The crate"\n',
      ),
    ).toBe("The crate");
    expect(
      manifestDescription(
        "pyproject.toml",
        '[tool.other]\ndescription = "not the project"\n',
      ),
    ).toBe(undefined);
  });
});

describe("manifestDescription on hostile input", () => {
  it.each([
    ["blank lines", `[package]\n${"\n".repeat(200_000)}description = "late"\n`],
    ["whitespace lines", `${"  \n".repeat(100_000)}[package]\n`],
    ["table openers", "[".repeat(200_000)],
    ["table headers", "[package]\n".repeat(20_000)],
    ["description keys", 'description = """\n'.repeat(20_000)],
  ])("finishes quickly on a TOML manifest of %s", (_name, manifest) => {
    const start = performance.now();

    manifestDescription("Cargo.toml", manifest);
    manifestDescription("pyproject.toml", manifest);

    expect(performance.now() - start).toBeLessThan(250);
  });

  it.each([
    ["tag openers", "<a ".repeat(100_000)],
    ["comment openers", "<!--".repeat(50_000)],
    ["nested elements", "<a>".repeat(100_000)],
  ])("finishes quickly on a pom.xml of %s", (_name, text) => {
    const start = performance.now();

    manifestDescription("pom.xml", text);

    expect(performance.now() - start).toBeLessThan(250);
  });
});
