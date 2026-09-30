import { describe, expect, it } from "vitest";

import { escapeForTerminal } from "./escape.js";

describe("escapeForTerminal", () => {
  it("leaves ordinary paths, including non-ASCII ones, untouched", () => {
    expect(escapeForTerminal("src/größe/日本語.ts")).toBe(
      "src/größe/日本語.ts",
    );
  });

  it("encodes C0 controls, DEL and C1 controls as visible escapes", () => {
    expect(escapeForTerminal("a\u001B[31m\nb\u007Fc\u0085d")).toBe(
      "a\\u001b[31m\\u000ab\\u007fc\\u0085d",
    );
  });

  it("encodes line separators and bidirectional overrides", () => {
    expect(escapeForTerminal("a\u2028b\u202Ec")).toBe("a\\u2028b\\u202ec");
  });

  it("doubles backslashes so escapes stay unambiguous", () => {
    expect(escapeForTerminal("a\\u001b")).toBe("a\\\\u001b");
  });
});
