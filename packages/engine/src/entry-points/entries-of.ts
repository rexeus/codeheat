// Owns making one entry point of a territory's findings: a territory that is
// both a boundary and a hotspot is one place to start, not two.
import type { Candidate, Entry } from "./candidate.js";

const findingOf = ({
  kind,
  verdict,
  designMove,
  evidence,
  files,
}: Candidate): Entry["findings"][number] => ({
  kind,
  verdict,
  designMove,
  evidence,
  files,
});

/** Whether the candidate is about one territory as a whole, which a second finding may share. */
const isTerritoryFinding = ({ kind }: Candidate): boolean =>
  kind === "boundary" || kind === "hotspot";

/** The stronger of two findings about one territory: the higher score, a boundary on a tie. */
const primaryOf = (
  a: Candidate,
  b: Candidate,
): readonly [Candidate, Candidate] =>
  b.score > a.score || (b.score === a.score && b.kind === "boundary")
    ? [b, a]
    : [a, b];

const single = (candidate: Candidate): Entry => ({
  ...candidate,
  findings: [findingOf(candidate)],
});

/**
 * The entries of `candidates`: every candidate is one entry, except that a
 * territory with both a `boundary` and a `hotspot` candidate becomes one entry
 * whose `kind`, `score`, `verdict`, and `designMove` are those of the stronger
 * (the higher score, a boundary on a tie), with both findings, the stronger
 * first. Its evidence holds both findings' numbers (the stronger's win where
 * a name repeats) and its `files` are empty, since the entry then concerns
 * the whole territory.
 */
export const entriesOf = (
  candidates: ReadonlyArray<Candidate>,
): ReadonlyArray<Entry> => {
  const byTerritory = new Map<string, Array<Candidate>>();
  for (const candidate of candidates.filter((each) =>
    isTerritoryFinding(each),
  )) {
    const key = candidate.territories[0] ?? "";
    byTerritory.set(key, [...(byTerritory.get(key) ?? []), candidate]);
  }
  return candidates.flatMap((candidate): Array<Entry> => {
    if (!isTerritoryFinding(candidate)) {
      return [single(candidate)];
    }
    const own = byTerritory.get(candidate.territories[0] ?? "") ?? [];
    const other = own.find((each) => each.kind !== candidate.kind);
    if (other === undefined) {
      return [single(candidate)];
    }
    const [primary, secondary] = primaryOf(candidate, other);
    // the pair is visited twice, once from each finding; keep the visit of the primary
    if (primary !== candidate) {
      return [];
    }
    return [
      {
        kind: primary.kind,
        score: primary.score,
        territories: primary.territories,
        files: [],
        evidence: { ...secondary.evidence, ...primary.evidence },
        verdict: primary.verdict,
        designMove: primary.designMove,
        findings: [findingOf(primary), findingOf(secondary)],
      },
    ];
  });
};
