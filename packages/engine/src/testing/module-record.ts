// Tests only: a measured module record with every field at its neutral value.
import type { Module } from "../report/module.js";

/** A module with `commits` counted commits that is not test-only unless said; everything else is neutral. */
export const moduleRecord = (
  path: string,
  commits: number,
  testOnly = false,
): Module => ({
  path,
  kind: "package",
  files: 4,
  testOnly,
  commits,
  localCommits: 0,
  cohesion: 0,
  partners: [],
  entryPoints: [],
  interfaceCommits: 0,
  implementationCommits: 0,
  leakage: null,
  leakyInterface: false,
  depth: null,
  trend: null,
});
