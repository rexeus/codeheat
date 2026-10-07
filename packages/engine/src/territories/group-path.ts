// Owns the name of a group of folders that change together: one brace glob.

const segmentsOf = (path: string): ReadonlyArray<string> =>
  path === "" ? [] : path.split("/");

/** How many leading segments every path shares, leaving each at least its last one. */
const sharedDepth = (paths: ReadonlyArray<ReadonlyArray<string>>): number => {
  const [first = [], ...others] = paths;
  const limit = Math.min(...paths.map((segments) => segments.length)) - 1;
  const differs = first.findIndex(
    (segment, index) =>
      index >= limit || others.some((other) => other[index] !== segment),
  );
  return differs === -1 ? Math.max(limit, 0) : differs;
};

/** A member's name inside the braces, with the characters a brace glob gives meaning escaped by a backslash. */
const escapeMember = (name: string): string =>
  name.replaceAll(/[\\,{}]/gu, (special) => `\\${special}`);

/**
 * The name of a group of folders (repository-relative POSIX directories, in
 * the order given) as one brace glob over the directory they share:
 * `packages/a/x` and `packages/a/y` are `packages/a/{x,y}`, folders at the
 * root `{x,y}`, and folders that branch deeper keep the rest of their path
 * inside the braces (`packages/{a/src,b}`). Inside the braces `\`, `,`, `{`,
 * and `}` are escaped with a backslash (`a/{x\,y,z}`); the shared directory
 * is written as it is, and the glob is the braces that close the name.
 */
export const groupPath = (paths: ReadonlyArray<string>): string => {
  const segments = paths.map((path) => segmentsOf(path));
  const depth = sharedDepth(segments);
  const shared = (segments[0] ?? []).slice(0, depth).join("/");
  const rests = segments.map((each) =>
    escapeMember(each.slice(depth).join("/")),
  );
  return `${shared === "" ? "" : `${shared}/`}{${rests.join(",")}}`;
};
