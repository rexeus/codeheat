import { Context } from "effect";

/**
 * The directory relative CLI paths resolve against. Tests provide a
 * temporary directory instead of changing the shared process directory.
 */
export const WorkingDirectory = Context.Reference<string>(
  "codeheat/WorkingDirectory",
  { defaultValue: () => process.cwd() },
);
