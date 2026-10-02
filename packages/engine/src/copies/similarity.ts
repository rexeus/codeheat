// Owns how alike two files are: the overlap of the five-word runs they contain.

const SHINGLE_SIZE = 5;

/** The distinct runs of five consecutive words (see `tokenize`); none for fewer than five words. */
export const shinglesOf = (
  tokens: ReadonlyArray<string>,
): ReadonlySet<string> => {
  const shingles = new Set<string>();
  for (let start = 0; start + SHINGLE_SIZE <= tokens.length; start += 1) {
    shingles.add(tokens.slice(start, start + SHINGLE_SIZE).join(" "));
  }
  return shingles;
};

/** `|a ∩ b| / |a ∪ b|`, 0 when both are empty. */
export const jaccard = (
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number => {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const shingle of small) {
    if (large.has(shingle)) {
      shared += 1;
    }
  }
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
};
