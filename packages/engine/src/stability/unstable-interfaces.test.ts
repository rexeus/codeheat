import { describe, expect, it } from "vitest";

import type { History } from "../history/history.js";
import { countKinds } from "../mechanical/kinds.js";
import type { ModuleRef } from "../modules/detect.js";
import { unstableInterfaces } from "./unstable-interfaces.js";

const API = "lib/api.ts";
const USERS = ["app/a.ts", "app/b.ts", "app/c.ts", "app/d.ts", "app/e.ts"];
const PATHS = [API, ...USERS, "lib/other.ts", "lib/test/api.helper.ts"];

const MODULES: ReadonlyMap<string, ModuleRef> = new Map(
  PATHS.map((path) => [
    path,
    { path: path.startsWith("lib") ? "lib" : "app", kind: "directory" },
  ]),
);

/** The dependents of each file: `USERS` import the API by default. */
const dependentsOf = (
  users: ReadonlyArray<string> = USERS,
  file = API,
): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map([[file, new Set(users)]]);

/** A change that touched the files named, by path. */
const commit = (...files: ReadonlyArray<string>) => ({
  files: Uint32Array.from(files.map((file) => PATHS.indexOf(file))),
  size: files.length,
  weight: 1,
});

/** A history in which each path has the logical changes given and, unless `revisions` says otherwise, as many changes. */
const historyOf = (
  changes: Readonly<Record<string, number>>,
  touched: ReadonlyArray<ReturnType<typeof commit>> = [],
  revisions: Readonly<Record<string, number>> = changes,
): History => ({
  paths: PATHS,
  files: new Map(
    Object.entries(changes).map(([path, count]) => [
      path,
      {
        revisions: revisions[path] ?? count,
        changes: count,
        weightedRevisions: revisions[path] ?? count,
        weightedChanges: count,
        linesAdded: 0,
        linesDeleted: 0,
      },
    ]),
  ),
  commits: [],
  changes: touched,
  logicalChanges: { by: "commit", count: touched.length, largest: 1 },
  mechanical: countKinds([]),
});

describe("unstableInterfaces selection", () => {
  it("reports a file with enough dependents that changes more often than their median", () => {
    const history = historyOf({
      [API]: 8,
      "app/a.ts": 2,
      "app/b.ts": 3,
      "app/c.ts": 5,
      "app/d.ts": 1,
      "app/e.ts": 9,
    });

    const [found] = unstableInterfaces(dependentsOf(), history, MODULES);

    expect(found).toMatchObject({
      path: API,
      module: "lib",
      fanIn: 5,
      changes: 8,
      medianDependentChanges: 3,
      changedDependents: 0,
    });
  });

  it("leaves out a file with fewer than five dependents or fewer than five logical changes", () => {
    const history = historyOf({ [API]: 8 });

    expect(
      unstableInterfaces(dependentsOf(USERS.slice(0, 4)), history, MODULES),
    ).toEqual([]);
    expect(
      unstableInterfaces(dependentsOf(), historyOf({ [API]: 4 }), MODULES),
    ).toEqual([]);
  });

  it("measures the churn in logical changes, not in commits", () => {
    const history = historyOf({ [API]: 3, "app/a.ts": 0 }, [], {
      [API]: 20,
      "app/a.ts": 0,
    });

    expect(unstableInterfaces(dependentsOf(), history, MODULES)).toEqual([]);
  });

  it("leaves out a file that changes no more often than its typical dependent", () => {
    const history = historyOf({
      [API]: 6,
      "app/a.ts": 6,
      "app/b.ts": 7,
      "app/c.ts": 9,
      "app/d.ts": 1,
      "app/e.ts": 2,
    });

    expect(unstableInterfaces(dependentsOf(), history, MODULES)).toEqual([]);
  });

  it("leaves out test code, however many files import it", () => {
    const helper = "lib/test/api.helper.ts";

    expect(
      unstableInterfaces(
        dependentsOf(USERS, helper),
        historyOf({ [helper]: 12 }),
        MODULES,
      ),
    ).toEqual([]);
  });
});

describe("unstableInterfaces ripple", () => {
  const history = historyOf({ [API]: 6, "lib/other.ts": 6 }, [
    commit(API, "app/a.ts", "app/b.ts"),
    commit(API, "app/a.ts", "lib/other.ts"),
    commit(API, "lib/other.ts"),
    commit("app/c.ts"),
  ]);

  it("counts the dependents that changed in a commit with the file, and names the most frequent", () => {
    const [found] = unstableInterfaces(dependentsOf(), history, MODULES);

    expect(found?.changedDependents).toBe(2);
    expect(found?.dependents).toEqual([
      { path: "app/a.ts", sharedCommits: 2 },
      { path: "app/b.ts", sharedCommits: 1 },
    ]);
    expect(found?.reason).toBe(
      "5 files depend on it and it changed in 6 logical changes, against a median of 0 for them; 2 of them changed together with it",
    );
  });

  it("ignores a commit too large to count and a file that does not depend on it", () => {
    const large = { ...commit(API, "app/e.ts"), size: 51 };

    const [found] = unstableInterfaces(
      dependentsOf(),
      { ...history, changes: [...history.changes, large] },
      MODULES,
    );

    expect(found?.changedDependents).toBe(2);
  });

  it("ranks the file that changed with the most dependents first, then more changes", () => {
    const dependents = new Map<string, ReadonlySet<string>>([
      [API, new Set(USERS)],
      ["lib/other.ts", new Set(USERS)],
    ]);

    const ranked = unstableInterfaces(dependents, history, MODULES);

    expect(
      ranked.map(({ path, changedDependents }) => [path, changedDependents]),
    ).toEqual([
      [API, 2],
      ["lib/other.ts", 1],
    ]);
  });
});
