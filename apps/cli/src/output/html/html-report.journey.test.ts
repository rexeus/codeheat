import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { makeTempDirectory } from "../../testing/git-repository.js";
import { journey } from "../../testing/journey-harness.js";
import { makeCoupledProject, withPath } from "../../testing/projects.js";

const EMBEDDED_REPORT =
  /<script type="application\/json" id="report">(?<json>.*?)<\/script>/su;

const embeddedReport = (html: string) =>
  Schema.decodeUnknownEffect(Report)(
    JSON.parse(EMBEDDED_REPORT.exec(html)?.groups?.["json"] ?? "null"),
  );

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat analyze --html", () => {
  it.live(
    "writes the untruncated report into the treemap and keeps stdout for --json",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;
        const out = join(yield* makeTempDirectory, "heat.html");

        const result = yield* journey({
          args: [
            "analyze",
            "--json",
            "--limit",
            "1",
            "--out",
            out,
            "--no-open",
          ],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe(`codeheat: wrote ${out}`);
        const printed = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(printed.files).toHaveLength(1);
        const embedded = yield* embeddedReport(readFileSync(out, "utf8"));
        expect(embedded.files).toHaveLength(3);
      }).pipe(Effect.scoped),
  );

  it.live(
    "writes codeheat-report.html into the working directory by default",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;

        const result = yield* journey({
          args: ["analyze", "--html", "--no-open"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(repo.root, "codeheat-report.html"))).toBe(true);
      }).pipe(Effect.scoped),
  );

  it.live("exits 1 when the treemap file cannot be written", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;
      const out = join(repo.root, "missing", "heat.html");

      const result = yield* journey({
        args: ["analyze", "--out", out, "--no-open"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`codeheat: cannot write ${out}`);
      expect(result.exitCode).toBe(1);
    }).pipe(Effect.scoped),
  );
});

describe("codeheat analyze --html in the browser", () => {
  it.live.skipIf(process.platform !== "linux")(
    "starts the browser without waiting for it or killing it on exit",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;
        const bin = yield* makeTempDirectory;
        const log = join(bin, "opener.log");
        // A launcher that keeps the browser in the foreground, as xdg-open's $BROWSER path does.
        writeFileSync(
          join(bin, "xdg-open"),
          `#!/bin/sh\necho "started $1" >> ${log}\nsleep 2\necho survived >> ${log}\n`,
        );
        chmodSync(join(bin, "xdg-open"), 0o755);
        yield* withPath(`${bin}:${process.env["PATH"] ?? ""}`);

        const started = Date.now();
        const result = yield* journey({
          args: ["analyze", "--html"],
          cwd: repo.root,
        });
        const elapsed = Date.now() - started;
        yield* Effect.sleep("3 seconds");

        expect(result.exitCode).toBe(0);
        expect(elapsed).toBeLessThan(1900);
        expect(readFileSync(log, "utf8")).toBe(
          `started ${join(repo.root, "codeheat-report.html")}\nsurvived\n`,
        );
      }).pipe(Effect.scoped),
    10_000,
  );
});
