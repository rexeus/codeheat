// The committed sample report, decoded with the engine's schema, for renderer tests.
import { readFileSync } from "node:fs";

import { Analysis } from "@codeheat/engine";
import { Schema } from "effect";

const sampleUrl = new URL(
  "../../../../fixtures/report.sample.json",
  import.meta.url,
);

/** `fixtures/report.sample.json`: 32 files, 4 of test code, and 6 couplings. */
export const sampleReport = (): Analysis =>
  Schema.decodeUnknownSync(Analysis)(
    JSON.parse(readFileSync(sampleUrl, "utf8")),
  );
