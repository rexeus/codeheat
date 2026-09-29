import { Command } from "effect/cli";

import packageJson from "../package.json" with { type: "json" };

const root = Command.make("codeheat").pipe(
  Command.withDescription(
    "Find hotspots and change coupling in a git repository.",
  ),
);

/** Runs codeheat against the given arguments (without the node and script path). */
export const runCli = Command.runWith(root, { version: packageJson.version });
