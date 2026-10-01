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

  it("leaves Windows paths untouched so they stay pasteable", () => {
    expect(escapeForTerminal("C:\\Users\\me\\codeheat-report.html")).toBe(
      "C:\\Users\\me\\codeheat-report.html",
    );
    expect(escapeForTerminal("\\\\server\\share\\x.ts")).toBe(
      "\\\\server\\share\\x.ts",
    );
  });

  it("leaves backslashes before ordinary letters untouched", () => {
    expect(escapeForTerminal("C:\\Users\\me\\src\\utils\\x.ts")).toBe(
      "C:\\Users\\me\\src\\utils\\x.ts",
    );
  });

  it("doubles a backslash run before something that reads as an escape", () => {
    expect(escapeForTerminal("a\\u001b.ts")).toBe("a\\\\u001b.ts");
    expect(escapeForTerminal("a\\\\u001b.ts")).toBe("a\\\\\\\\u001b.ts");
  });

  it("prints a literal backslash before ESC differently from a literal escape text", () => {
    const literalEscapeText = escapeForTerminal("a\\\\u001b.ts");
    const backslashThenEsc = escapeForTerminal("a\\\u001B.ts");

    expect(backslashThenEsc).toBe("a\\\\\\u001b.ts");
    expect(literalEscapeText).not.toBe(backslashThenEsc);
  });
});
