// Owns which coupled pairs count as distant and how they rank: the places
// where structurally distant code keeps changing together.
import { Order } from "effect";

import { directoryDistance } from "../coupling/pair.js";
import type { ModuleRef } from "../modules/detect.js";
import { isTestPath } from "../modules/test-path.js";
import type { DistantCoupling } from "../report/distant-coupling.js";
import { roundReported } from "../report/precision.js";
import type { Coupling } from "../report/report.js";

/** The report keeps this many distant couplings, best first; `--limit` cuts further. */
const MAX_DISTANT_COUPLINGS = 50;

/**
 * Directory hops at which two files of one module count as distant: siblings
 * (2) share a parent and are one feature, cousins (4) are not.
 */
export const MIN_LOCAL_DISTANCE = 3;

/** How much more a pair ranks when no import explains its coupling. */
const HIDDEN_BOOST = 1.5;

/** Shared changes at which a pair's evidence counts in full; fewer weigh in proportion. */
const FULL_EVIDENCE_COMMITS = 10;

/**
 * Whether a coupled pair can be a design statement at all: it involves no
 * test-code file (a test belongs next to the code it checks, and a step file
 * or helper next to nothing in particular), and is no pair of two contract
 * files (the files of one API definition change together by design).
 */
export const isJudgeablePair = (coupling: Coupling): boolean =>
  !isTestPath(coupling.a) &&
  !isTestPath(coupling.b) &&
  !(coupling.kinds.a === "contract" && coupling.kinds.b === "contract");

/**
 * Whether a coupled pair is distant: it is a judgeable pair (see
 * `isJudgeablePair`) that crosses modules or lies at least
 * `MIN_LOCAL_DISTANCE` directory hops apart within one.
 */
export const isDistantCoupling = (coupling: Coupling): boolean =>
  isJudgeablePair(coupling) &&
  (coupling.crossesModule || coupling.distance >= MIN_LOCAL_DISTANCE);

/** A path inside the module directory, so that its parent directory is the module's; "." is the repository root. */
const probe = (module: string): string =>
  module === "." ? "_" : `${module}/_`;

/** Directory hops between two module directories. */
const moduleDistance = (a: string, b: string): number =>
  directoryDistance(probe(a), probe(b));

const byScore = (a: DistantCoupling, b: DistantCoupling): number =>
  b.score - a.score ||
  b.strength - a.strength ||
  b.sharedCommits - a.sharedCommits ||
  Order.String(a.a, b.a) ||
  Order.String(a.b, b.b);

/**
 * The distant couplings among `couplings` (see `isDistantCoupling`), the
 * `MAX_DISTANT_COUPLINGS` best first: by score, then strength, shared
 * changes, and path. `modules` places every path of the couplings, contract
 * files included; a path it lacks lives in the root module.
 */
export const distantCouplings = (
  couplings: ReadonlyArray<Coupling>,
  modules: ReadonlyMap<string, ModuleRef>,
): ReadonlyArray<DistantCoupling> => {
  const distant = couplings.filter((coupling) => isDistantCoupling(coupling));
  const largest = distant.reduce(
    (most, { distance }) => Math.max(most, distance),
    1,
  );
  return distant
    .map((coupling): DistantCoupling => {
      const module = {
        a: modules.get(coupling.a)?.path ?? ".",
        b: modules.get(coupling.b)?.path ?? ".",
      };
      const reach = coupling.crossesModule
        ? 1 + Math.log2(1 + moduleDistance(module.a, module.b))
        : coupling.distance / largest;
      const hidden = coupling.imports === "none" ? HIDDEN_BOOST : 1;
      const evidence = Math.min(
        1,
        coupling.sharedCommits / FULL_EVIDENCE_COMMITS,
      );
      return {
        a: coupling.a,
        b: coupling.b,
        sharedCommits: coupling.sharedCommits,
        strength: coupling.degree,
        distance: coupling.distance,
        crossesModule: coupling.crossesModule,
        modules: module,
        imports: coupling.imports,
        score: roundReported(coupling.degree * reach * hidden * evidence),
      };
    })
    .toSorted(byScore)
    .slice(0, MAX_DISTANT_COUPLINGS);
};
