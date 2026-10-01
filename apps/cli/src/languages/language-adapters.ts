// Owns where the engine gets its language adapters from: the CLI loads the
// parser, because only the CLI package depends on it. The parser is a native
// module that loads lazily, so a machine without a binding for its platform
// still runs everything except the import relations and the module depth.
import { typescriptAdapter } from "@codeheat/engine";
import type { LanguageAdapter } from "@codeheat/engine";
import { Context, Effect, Schema } from "effect";

/** The parser could not be loaded; `reason` is the first line of what Node said. */
export class ParserUnavailable extends Schema.TaggedError<ParserUnavailable>()(
  "ParserUnavailable",
  { reason: Schema.String },
) {}

const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";

const loadOxcAdapters = Effect.tryPromise({
  try: () => import("oxc-parser"),
  catch: (error) => new ParserUnavailable({ reason: firstLine(error) }),
}).pipe(Effect.map(({ parseSync }) => [typescriptAdapter(parseSync)]));

/**
 * How to obtain the language adapters: by loading oxc-parser, unless a test
 * provides another effect to simulate a missing binding.
 */
export const LanguageAdapters = Context.Reference<
  Effect.Effect<ReadonlyArray<LanguageAdapter>, ParserUnavailable>
>("codeheat/LanguageAdapters", { defaultValue: () => loadOxcAdapters });
