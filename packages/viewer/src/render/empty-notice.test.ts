import { describe, expect, it } from "vitest";

import { EMPTY_NOTICE } from "./empty-notice.js";

describe("EMPTY_NOTICE", () => {
  it("points at the path argument and the file selection flags, not the time window", () => {
    expect(EMPTY_NOTICE).toEqual({
      title: "No files in the analysis universe",
      detail:
        "No code files were selected, so there is nothing to map. Check the path argument, or choose files with --include and --exclude.",
    });
    expect(EMPTY_NOTICE.detail).not.toContain("--since");
  });
});
