/**
 * Builds the viewer assets the CLI embeds, for `pnpm --filter codeheat dev`.
 * turbo prints its banner and run summary to stdout, which would end up in
 * front of the CLI's `--json` document and has no flag to silence it, so the
 * build's stdout goes to stderr; build errors still show up there.
 */
import { spawnSync } from "node:child_process";

// One fixed command line: a shell resolves `turbo` to `turbo.cmd` on Windows.
const build = spawnSync(
  "turbo run build --filter=@codeheat/viewer --output-logs=errors-only",
  { shell: true, stdio: ["inherit", 2, "inherit"] },
);

process.exitCode = build.status ?? 1;
