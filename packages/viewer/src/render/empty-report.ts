import type { Report } from "@codeheat/engine";

import { h } from "./dom.js";
import { EMPTY_NOTICE } from "./empty-notice.js";

/** Keeps a flag such as `--since` on one line; the text splits before each flag. */
const withFlags = (text: string): (Node | string)[] =>
  text
    .split(/(--[a-z]+)/u)
    .map((part, index) => (index % 2 === 1 ? h("span", "flag", part) : part));

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
