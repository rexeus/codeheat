import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeCoupledProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat analyze --html followed by a .html file name", () => {
  it.live(
    "hints at --out and analyzes nothing when the file does not exist",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;

        const result = yield* journey({
          args: ["analyze", "--html", "report.html", "--no-open"],
          cwd: repo.root,
        });

        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(
          "codeheat: --html takes no file name; to write the treemap to report.html, use --out report.html (to analyze a directory of that name, write report.html/)",
        );
        expect(result.exitCode).toBe(2);
        expect(existsSync(join(repo.root, "codeheat-report.html"))).toBe(false);
      }).pipe(Effect.scoped),
  );

  it.live(
    "hints even when a directory of that name exists, ignoring case",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;
        mkdirSync(join(repo.root, "Site.HTML"));

        const result = yield* journey({
          args: ["analyze", "Site.HTML", "--html", "--no-open"],
          cwd: repo.root,
        });

        expect(result.stderr).toContain("use --out Site.HTML ");
        expect(result.exitCode).toBe(2);
      }).pipe(Effect.scoped),
  );

  it.live("quotes and escapes the suggested file name for the terminal", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["analyze", "--html", "my \u001B[31mreport.html", "--no-open"],
        cwd: repo.root,
      });

      expect(result.stderr).toContain('use --out "my \\u001b[31mreport.html" ');
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );
});

describe("codeheat analyze --html with a path that is not a file name", () => {
  it.live(
    "analyzes a directory named like a file when it ends in a slash",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;
        mkdirSync(join(repo.root, "x.html"));

        const result = yield* journey({
          args: ["analyze", "./x.html/", "--html", "--no-open"],
          cwd: repo.root,
        });

        expect(result.stderr).not.toContain("--out");
        expect(result.exitCode).toBe(0);
        expect(existsSync(join(repo.root, "codeheat-report.html"))).toBe(true);
      }).pipe(Effect.scoped),
  );

  it.live("leaves a .html path alone when --out names the file", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: [
          "analyze",
          "page.html",
          "--html",
          "--out",
          "r.html",
          "--no-open",
        ],
        cwd: repo.root,
      });

      expect(result.stderr).toBe(
        `codeheat: no such file or directory: ${repo.root}/page.html`,
      );
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );

  it.live("leaves --html with a directory argument alone", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["analyze", "src", "--html", "--no-open"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(repo.root, "codeheat-report.html"))).toBe(true);
    }).pipe(Effect.scoped),
  );
});
