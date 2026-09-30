// Tests only: sets process environment variables for the lifetime of a scope.
import { Effect } from "effect";
import type { Scope } from "effect";

/**
 * Sets `variables` in `process.env` and restores the previous values when the
 * scope closes. Child processes spawned meanwhile inherit them.
 */
export const setScopedEnv = (
  variables: Readonly<Record<string, string>>,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const previous = Object.keys(variables).map(
        (name) => [name, process.env[name]] as const,
      );
      Object.assign(process.env, variables);
      return previous;
    }),
    (previous) =>
      Effect.sync(() => {
        for (const [name, value] of previous) {
          if (value === undefined) {
            delete process.env[name];
          } else {
            process.env[name] = value;
          }
        }
      }),
  ).pipe(Effect.asVoid);
