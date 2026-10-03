// Owns how alike two files are: the overlap of the five-word runs they contain.

const SHINGLE_SIZE = 5;
const FNV_OFFSET = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;

/** FNV-1a over the code points of one word: 32 bits. */
const hashWord = (word: string): number => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < word.length; index += 1) {
    hash = Math.imul(hash ^ (word.codePointAt(index) ?? 0), FNV_PRIME);
  }
  return hash;
};

/**
 * The distinct runs of five consecutive words (see `tokenize`) of a file, each
 * as a 32-bit hash of its words in order; none for fewer than five words.
 * Hashing keeps the sets small and fast to build. Two different runs share a
 * hash with probability 2^-32, so two files of 50 000 runs each count about
 * one run too many in common, a change of 0.002% in their similarity:
 * collisions cost precision negligibly and are not corrected.
 */
export const shinglesOf = (
  tokens: ReadonlyArray<string>,
): ReadonlySet<number> => {
  const words = tokens.map((token) => hashWord(token));
  const shingles = new Set<number>();
  for (let start = 0; start + SHINGLE_SIZE <= words.length; start += 1) {
    let hash = FNV_OFFSET;
    for (let offset = 0; offset < SHINGLE_SIZE; offset += 1) {
      hash = Math.imul(hash ^ (words[start + offset] ?? 0), FNV_PRIME);
    }
    shingles.add(hash ^ (hash >>> 15));
  }
  return shingles;
};

/** `|a ∩ b| / |a ∪ b|`, 0 when both are empty. */
export const jaccard = (
  a: ReadonlySet<number>,
  b: ReadonlySet<number>,
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
