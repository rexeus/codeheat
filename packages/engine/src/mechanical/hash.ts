// Owns the hashes that keep commits' shapes and patches comparable without
// keeping their text.

const OFFSET = 0x81_1c_9d_c5;
const PRIME = 0x01_00_01_93;
const SEED_MIX = 0x9e_37_79_b1;

const startOf = (seed: number): number =>
  (OFFSET ^ Math.imul(seed, SEED_MIX)) >>> 0;

const step = (state: number, text: string): number => {
  let value = state;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ (text.codePointAt(index) ?? 0), PRIME);
  }
  return value >>> 0;
};

/**
 * A 32-bit FNV-1a style hash of `text`, different for each `seed`; only its
 * stability matters, never its strength.
 */
export const hashText = (text: string, seed = 0): number =>
  step(startOf(seed), text);

/**
 * A 64-bit hash (two seeds) of the lines fed to it, one `update` at a time, so
 * that a patch of any size is hashed without being held in one string or one
 * argument list.
 */
export class LineHash {
  #first = startOf(1);
  #second = startOf(2);
  #lines = 0;

  /** Adds one line; the line break is part of the hash. */
  update(line: string): void {
    this.#first = step(step(this.#first, line), "\n");
    this.#second = step(step(this.#second, line), "\n");
    this.#lines += 1;
  }

  /** The hash of the lines so far. */
  digest(): string {
    return `${this.#first}:${this.#second}:${this.#lines}`;
  }
}
