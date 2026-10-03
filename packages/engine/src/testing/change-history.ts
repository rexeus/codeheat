// Tests only: the history of a window written as the paths each change touched.
import type { LogicalChange } from "../changes/logical-change.js";
import type { SubjectKind } from "../changes/subject-kind.js";
import type { History } from "../history/history.js";

/**
 * A window of counted changes, one per list of `paths`, in order; `fixes`
 * names the (zero-based) changes whose subject says they fix something.
 */
export const changeHistory = (
  changes: ReadonlyArray<ReadonlyArray<string>>,
  fixes: ReadonlyArray<number> = [],
): Pick<History, "changes" | "paths"> => {
  const paths = [...new Set(changes.flat())];
  return {
    paths,
    changes: changes.map((touched, index): LogicalChange => {
      const subjectKind: SubjectKind = fixes.includes(index) ? "fix" : "other";
      return {
        subjectKind,
        files: Uint32Array.from(new Set(touched), (path) =>
          paths.indexOf(path),
        ),
        size: new Set(touched).size,
      };
    }),
  };
};
