// Owns listing the symbols a TypeScript or JavaScript file exports, from the
// parser's module record, and refusing to list them where the record is not
// the whole story.
import type { SourceExports } from "./language-adapter.js";
import { exportsOutsideRecord } from "./typescript-ast.js";

/** The `staticExports` of the parser's module record: one entry per exported name. */
export type StaticExports = ReadonlyArray<{
  readonly entries: ReadonlyArray<{
    readonly moduleRequest: { readonly value: string } | null;
    readonly importName: { readonly kind: string };
    readonly exportName: {
      readonly kind: string;
      readonly name: string | null;
    };
    readonly localName: { readonly name: string | null };
  }>;
}>;

type Entry = StaticExports[number]["entries"][number];

/** Sources without any of these cannot export outside the module record: no `exports`, no `export =`, no `__export` helper. */
const MENTIONS_UNLISTED_EXPORT = /\bexports\b|\bexport\s*=|__export/u;

/** What one entry of the record exports: a name, a module to forward, or nothing we can tell. */
type Exported =
  | { readonly name: string }
  | { readonly forwarded: string }
  | undefined;

const exportedBy = ({
  moduleRequest,
  importName,
  exportName,
}: Entry): Exported => {
  if (importName.kind === "AllButDefault") {
    return moduleRequest === null
      ? undefined
      : { forwarded: moduleRequest.value };
  }
  if (exportName.kind === "Default") {
    return { name: "default" };
  }
  return exportName.name === null ? undefined : { name: exportName.name };
};

/**
 * The names `staticExports` lists and the modules it forwards with
 * `export * from`; undefined when an entry is not understood, or when the
 * file also exports in a way the record lacks (`export =`, CommonJS: see
 * `exportsOutsideRecord`), because the list would then be incomplete.
 */
export const exportedSymbols = (
  staticExports: StaticExports,
  program: unknown,
  source: string,
): SourceExports | undefined => {
  if (MENTIONS_UNLISTED_EXPORT.test(source) && exportsOutsideRecord(program)) {
    return undefined;
  }
  const names = new Set<string>();
  const forwarded = new Set<string>();
  for (const { entries } of staticExports) {
    for (const entry of entries) {
      const exported = exportedBy(entry);
      if (exported === undefined) {
        return undefined;
      }
      if ("name" in exported) {
        names.add(exported.name);
      } else {
        forwarded.add(exported.forwarded);
      }
    }
  }
  return { names: [...names], forwarded: [...forwarded] };
};
