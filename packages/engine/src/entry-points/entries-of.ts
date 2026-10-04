// Owns making one entry point of a territory's findings: a territory that is
// both a boundary and a hotspot is one place to start, not two.
import { findingOf } from "./candidate.js";
import type { Candidate, Entry } from "./candidate.js";

/** The candidate with its own finding first, then the findings it is made of. */
const findingsOf = (candidate: Candidate): Entry["findings"] => [
  findingOf(candidate),
  ...(candidate.parts ?? []),
];

const single = (candidate: Candidate): Entry => ({
  kind: candidate.kind,
  score: candidate.score,
  territories: candidate.territories,
  files: candidate.files,
  evidence: candidate.evidence,
  verdict: candidate.verdict,
  designMove: candidate.designMove,
  findings: findingsOf(candidate),
});

/**
 * The entry of a boundary and the hotspots of its territories: the stronger
 * finding (the higher score, a boundary on a tie) leads.
 */
const together = (
  boundary: Candidate,
  hotspots: ReadonlyArray<Candidate>,
): Entry => {
  const [primary = boundary, ...others] = [boundary, ...hotspots].toSorted(
    (a, b) => b.score - a.score,
  );
  return {
    kind: primary.kind,
    score: primary.score,
    territories: [
      ...new Set(
        [primary, ...others].flatMap(({ territories }) => territories),
      ),
    ],
    files: [],
    evidence: Object.fromEntries(
      [...others.toReversed(), primary].flatMap(({ evidence }) =>
        Object.entries(evidence),
      ),
    ),
    verdict: primary.verdict,
    designMove: primary.designMove,
    findings: [primary, ...others].flatMap((each) => findingsOf(each)),
  };
};

/**
 * The entries of `candidates`: every candidate is one entry, except that a
 * `boundary` and the `hotspot` of a territory it concerns become one entry,
 * whose `kind`, `score`, `verdict`, and `designMove` are those of the stronger
 * (the higher score, a boundary on a tie), with all their findings, the
 * stronger first, the findings a boundary is made of after its own. Its
 * evidence holds the numbers of all of them (the stronger's win where a name
 * repeats), its `territories` are those of all of them, and its `files` are
 * empty, since the entry then concerns whole territories. A boundary between
 * two territories takes the hotspots of both.
 */
export const entriesOf = (
  candidates: ReadonlyArray<Candidate>,
): ReadonlyArray<Entry> => {
  const boundaries = candidates.filter(({ kind }) => kind === "boundary");
  const hotspotsOf = (boundary: Candidate): ReadonlyArray<Candidate> =>
    candidates.filter(
      ({ kind, territories }) =>
        kind === "hotspot" &&
        territories.some((id) => boundary.territories.includes(id)),
    );
  const joined = new Set(boundaries.flatMap((each) => hotspotsOf(each)));
  return [
    ...boundaries.map((boundary) => together(boundary, hotspotsOf(boundary))),
    ...candidates
      .filter(({ kind }) => kind !== "boundary")
      .filter((candidate) => !joined.has(candidate))
      .map((candidate) => single(candidate)),
  ];
};
