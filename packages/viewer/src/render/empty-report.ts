import type { Report } from "@codeheat/engine";

import { h, withFlags } from "./dom.js";
import { EMPTY_NOTICE } from "./empty-notice.js";

/** Overlays the notice on `stage` when `report` has no files; otherwise leaves it alone. */
export const showEmptyNotice = (report: Report, stage: HTMLElement): void => {
  if (report.files.length > 0) {
    return;
  }
  stage.append(
    h(
      "div",
      "empty",
      h("strong", "empty-title", EMPTY_NOTICE.title),
      h("p", "empty-detail", ...withFlags(EMPTY_NOTICE.detail)),
    ),
  );
};
