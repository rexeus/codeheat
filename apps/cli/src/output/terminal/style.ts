// Owns ANSI styling; with color off every style is the identity, so layout code never branches.
import { Config, Effect, Option, Stdio } from "effect";

/** Wraps text in terminal styling, or leaves it as is when color is off. */
export type Style = {
  readonly bold: (text: string) => string;
  readonly dim: (text: string) => string;
  /** Colors `text` from green (cool) through yellow to red (hot) by a 0..1 score. */
  readonly heat: (score: number, text: string) => string;
};

const paint = (code: number, text: string): string =>
  `\u001B[${code}m${text}\u001B[0m`;

const heatCode = (score: number): number => {
  if (score >= 0.66) {
    return 31;
  }
  return score >= 0.33 ? 33 : 32;
};

/** The style for a terminal (`color`) or for pipes and files (`plain`). */
export const makeStyle = (color: boolean): Style =>
  color
    ? {
        bold: (text) => paint(1, text),
        dim: (text) => paint(2, text),
        heat: (score, text) => paint(heatCode(score), text),
      }
    : { bold: (text) => text, dim: (text) => text, heat: (_, text) => text };

/**
 * Whether output may carry ANSI: standard output is a terminal and
 * `NO_COLOR` is unset or empty (no-color.org).
 */
export const shouldUseColor: Effect.Effect<boolean, never, Stdio.Stdio> =
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio;
    const isTerminal = yield* stdio.stdoutIsTerminal;
    const noColor = yield* Config.String("NO_COLOR").pipe(
      Config.option,
      Effect.orElseSucceed(() => Option.none<string>()),
    );
    return isTerminal && Option.isNone(noColor);
  });
