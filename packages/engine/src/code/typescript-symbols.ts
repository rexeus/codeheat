// Owns listing the symbols a TypeScript or JavaScript file exports, from the
// parser's module record, and refusing to list them where the record is not
// the whole story.
import type { ExportedName, SourceExports } from "./language-adapter.js";
import { exportsOutsideRecord } from "./typescript-ast.js";

type Position = number | null;

/** The `staticExports` of the parser's module record: one entry per exported name. */
export type StaticExports = ReadonlyArray<{
  readonly entries: ReadonlyArray<{
    readonly start: number;
    readonly moduleRequest: {
      readonly value: string;
      readonly start: number;
    } | null;
    readonly importName: {
      readonly kind: string;
      readonly name: string | null;
      readonly start: Position;
    };
    readonly exportName: {
      readonly kind: string;
      readonly name: string | null;
    };
    readonly localName: { readonly name: string | null };
  }>;
}>;

/** The `staticImports` of the record, as far as binding an export to an import needs them. */
export type StaticImports = ReadonlyArray<{
  readonly moduleRequest: { readonly value: string };
  readonly entries: ReadonlyArray<{
    readonly importName: {
      readonly kind: string;
      readonly name: string | null;
      readonly start: Position;
    };
    readonly localName: { readonly value: string };
  }>;
}>;

type Entry = StaticExports[number]["entries"][number];
type Binding = ExportedName["binding"];
type ImportedBinding = Extract<Binding, { specifier: string }>;

/** Sources without any of these cannot export outside the module record: no `exports`, no `export =`, no `__export` helper. */
const MENTIONS_UNLISTED_EXPORT = /\bexports\b|\bexport\s*=|__export/u;

/** The binding `export default <expression>` creates; it has no name of its own. */
const DEFAULT_BINDING = "*default*";

/** What an import takes from its module: the name it is exported as there, `*` for the namespace object. */
const importedName = ({
  kind,
  name,
}: Entry["importName"]): string | undefined => {
  if (kind === "Default") {
    return "default";
  }
  if (kind === "NamespaceObject") {
    return "*";
  }
  return kind === "Name" && name !== null ? name : undefined;
};

/** Where the imports of a file bind their names, by local name and by the position of the import. */
type Imports = {
  readonly byLocal: ReadonlyMap<string, ImportedBinding>;
  readonly byPosition: ReadonlyMap<number, ImportedBinding>;
};

const readImports = (imports: StaticImports): Imports => {
  const bound = imports.flatMap(({ moduleRequest, entries }) =>
    entries.flatMap(({ importName, localName }) => {
      const name = importedName(importName);
      return name === undefined
        ? []
        : [
            {
              local: localName.value,
              position: importName.start,
              binding: { specifier: moduleRequest.value, name },
            },
          ];
    }),
  );
  return {
    byLocal: new Map(bound.map(({ local, binding }) => [local, binding])),
    byPosition: new Map(
      bound.flatMap(({ position, binding }) =>
        position === null ? [] : [[position, binding] as const],
      ),
    ),
  };
};

/** The binding an export entry stands for, or undefined when the record does not say. */
const bindingOf = (
  { start, moduleRequest, importName, exportName, localName }: Entry,
  imports: Imports,
): Binding | undefined => {
  if (moduleRequest !== null && moduleRequest.start < start) {
    // `import { a } from "m"; export { a }` comes as an indirect export whose
    // import name is the one of the import, which the position identifies.
    return importName.start === null
      ? undefined
      : imports.byPosition.get(importName.start);
  }
  if (moduleRequest !== null) {
    const name = importName.kind === "All" ? "*" : importedName(importName);
    return name === undefined
      ? undefined
      : { specifier: moduleRequest.value, name };
  }
  const local =
    localName.name ?? (exportName.kind === "Default" ? DEFAULT_BINDING : null);
  return local === null ? undefined : (imports.byLocal.get(local) ?? { local });
};

/**
 * The names `staticExports` lists with their bindings, and the modules it
 * forwards with `export * from`; undefined when an entry is not understood, or
 * when the file also exports in a way the record lacks (`export =`, CommonJS:
 * see `exportsOutsideRecord`), because the list would then be incomplete.
 */
export const exportedSymbols = (
  record: {
    readonly staticImports: StaticImports;
    readonly staticExports: StaticExports;
  },
  program: unknown,
  source: string,
): SourceExports | undefined => {
  if (MENTIONS_UNLISTED_EXPORT.test(source) && exportsOutsideRecord(program)) {
    return undefined;
  }
  const imports = readImports(record.staticImports);
  const entries = record.staticExports.flatMap((exported) => exported.entries);
  const forwarded = new Set<string>();
  const names = new Map<string, ExportedName>();
  for (const entry of entries) {
    const star = entry.importName.kind === "AllButDefault";
    if (star && entry.moduleRequest !== null) {
      forwarded.add(entry.moduleRequest.value);
      continue;
    }
    const name =
      entry.exportName.kind === "Default" ? "default" : entry.exportName.name;
    const binding = star ? undefined : bindingOf(entry, imports);
    if (name === null || binding === undefined) {
      return undefined;
    }
    names.set(name, names.get(name) ?? { name, binding });
  }
  return { names: [...names.values()], forwarded: [...forwarded] };
};
