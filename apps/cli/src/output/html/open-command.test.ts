import { describe, expect, it } from "vitest";

import { openCommand } from "./open-command.js";

describe("openCommand", () => {
  it("uses open on macOS", () => {
    expect(openCommand("darwin", "/r/heat.html")).toStrictEqual({
      command: "open",
      args: ["/r/heat.html"],
    });
  });

  it("hands the path to rundll32 on Windows, never through cmd", () => {
    const file = "C:\\R&D\\%TEMP%\\heat.html";

    expect(openCommand("win32", file)).toStrictEqual({
      command: "rundll32.exe",
      args: ["url.dll,FileProtocolHandler", file],
    });
  });

  it("uses xdg-open everywhere else", () => {
    expect(openCommand("linux", "/r/heat.html").command).toBe("xdg-open");
  });
});
