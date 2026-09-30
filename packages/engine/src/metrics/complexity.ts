// Owns indentation complexity: a language-agnostic proxy for structural
// complexity, the sum of logical indentation levels over non-blank lines.

/** Complexity of one file's text. */
export type Complexity = {
  /** Non-blank lines. */
  readonly loc: number;
  readonly total: number;
  /** `total / loc`; 0 for a file without code lines. */
  readonly mean: number;
  /** The deepest indentation level of any line. */
  readonly max: number;
};

const MIN_INDENT_UNIT = 2;
const MAX_INDENT_UNIT = 8;
const FALLBACK_INDENT_UNIT = 4;

type Indent = { readonly tabs: number; readonly spaces: number };

const leadingIndent = (line: string): Indent => {
  let tabs = 0;
  let spaces = 0;
  for (const char of line) {
    if (char === "\t") {
      tabs += 1;
    } else if (char === " ") {
      spaces += 1;
    } else {
      break;
    }
  }
  return { tabs, spaces };
};

/**
 * The file's space-indentation width: its most common increase in leading
 * spaces between consecutive code lines, clamped to 2..8. Ties pick the
 * smaller increase; a file without increases gets 4.
 */
const detectIndentUnit = (indents: ReadonlyArray<Indent>): number => {
  const counts = new Map<number, number>();
  for (let index = 1; index < indents.length; index++) {
    const delta =
      (indents[index]?.spaces ?? 0) - (indents[index - 1]?.spaces ?? 0);
    if (delta > 0) {
      counts.set(delta, (counts.get(delta) ?? 0) + 1);
    }
  }
  const [mostCommon] = [...counts].toSorted(
    ([deltaA, countA], [deltaB, countB]) => countB - countA || deltaA - deltaB,
  );
  const unit = mostCommon === undefined ? FALLBACK_INDENT_UNIT : mostCommon[0];
  return Math.min(MAX_INDENT_UNIT, Math.max(MIN_INDENT_UNIT, unit));
};

/**
 * Measures `text`. A tab is one level; spaces count `floor(spaces / unit)`
 * levels, with the unit detected per file. Blank lines are skipped.
 */
export const measureComplexity = (text: string): Complexity => {
  const indents = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => leadingIndent(line));
  const unit = detectIndentUnit(indents);
  const levels = indents.map(
    ({ tabs, spaces }) => Math.floor(spaces / unit) + tabs,
  );
  const total = levels.reduce((sum, level) => sum + level, 0);
  return {
    loc: levels.length,
    total,
    mean: levels.length === 0 ? 0 : total / levels.length,
    max: levels.reduce((deepest, level) => Math.max(deepest, level), 0),
  };
};
