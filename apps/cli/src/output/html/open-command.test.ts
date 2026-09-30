import { describe, expect, it } from "vitest";

import { openCommand } from "./open-command.js";

describe("openCommand", () => {
  it("uses open on macOS", () => {
    expect(openCommand("darwin", "/r/heat.html")).toStrictEqual({
      command: "open",
      args: ["/r/heat.html"],
    });
  });

  it("uses cmd start with an empty title on Windows", () => {
    expect(openCommand("win32", "C:\\r\\heat.html")).toStrictEqual({
      command: "cmd",
      args: ["/c", "start", '""', "C:\\r\\heat.html"],
    });
  });

  it("uses xdg-open everywhere else", () => {
    expect(openCommand("linux", "/r/heat.html").command).toBe("xdg-open");
  });
});
