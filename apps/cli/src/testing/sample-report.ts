// The committed sample report, decoded with the engine's schema, for renderer tests.
import { readFileSync } from "node:fs";

import { Report } from "@codeheat/engine";
import { Schema } from "effect";

const sampleUrl = new URL(
  "../../../../fixtures/report.sample.json",
  import.meta.url,
);

/** `fixtures/report.sample.json`: 36 files, 8 couplings, 3 of them test pairs. */
export const sampleReport = (): Report =>
  Schema.decodeUnknownSync(Report)(JSON.parse(readFileSync(sampleUrl, "utf8")));
