// Owns path patterns: repository-relative POSIX paths matched with picomatch,
// the same matcher the viewer's filter uses, so both agree on every pattern.
import picomatch from "picomatch";

const withoutLeadingDotSlash = (pattern: string): string =>
  pattern.startsWith("./") ? pattern.slice(2) : pattern;

/**
 * A predicate for whether a path matches any of `patterns`. Each pattern is
 * an exact path or a glob (`dot: true`); an empty list matches nothing.
 */
export const matchesAny = (
  patterns: ReadonlyArray<string>,
): ((path: string) => boolean) => {
  const normalized = patterns.map((pattern) => withoutLeadingDotSlash(pattern));
  if (normalized.length === 0) {
    return () => false;
  }
  const exact = new Set(normalized);
  const glob = picomatch(normalized, { dot: true });
  return (path) => exact.has(path) || glob(path);
};

/** Whether `pattern` has glob metacharacters; any other pattern names one path. */
export const isGlob = (pattern: string): boolean =>
  picomatch.scan(pattern).isGlob;
