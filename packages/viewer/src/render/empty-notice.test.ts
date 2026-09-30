import { describe, expect, it } from "vitest";

import { reportOf } from "../testing/reports.js";
import { emptyNotice } from "./empty-notice.js";

describe("emptyNotice", () => {
  it("names the analysis window and the flags that widen it", () => {
    const { window } = reportOf([]);

    expect(emptyNotice(window)).toEqual({
      title: "No files to show",
      detail:
        "No files were analyzed between 2025-09-29 and 2026-09-29. Widen the window with --since, or select files with --include.",
    });
  });
});
