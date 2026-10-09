// Tests only: a measured module record with every field at its neutral value.
import type { Module } from "../model/module.js";

/** A module with `commits` counted commits; everything else is neutral. */
export const moduleRecord = (path: string, commits: number): Module => ({
  path,
  kind: "package",
  files: 4,
  commits,
  localCommits: 0,
  cohesion: 0,
  radius: null,
  partners: [],
  entryPoints: [],
  interfaceCommits: 0,
  implementationCommits: 0,
  leakage: null,
  leakyInterface: false,
  depth: null,
  trend: null,
  erosion: null,
  fixDensity: null,
});
