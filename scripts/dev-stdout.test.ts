import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("..", import.meta.url).pathname;

describe("running the CLI from source", () => {
  it("builds the viewer assets without writing to stdout", () => {
    const build = spawnSync(
      "pnpm",
      [
        "--silent",
        "--filter",
        "codeheat",
        "exec",
        "tsx",
        "scripts/build-viewer.ts",
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    expect({ status: build.status, stdout: build.stdout }).toEqual({
      status: 0,
      stdout: "",
    });
  }, 120_000);
});
