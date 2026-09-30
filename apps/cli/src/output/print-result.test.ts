import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Console, Effect, Layer, Stdio } from "effect";

import { printResult } from "./print-result.js";
import type { Style } from "./terminal/style.js";

const bold = (text: string, style: Style): string => style.bold(text);

const printed = (options: {
  readonly json: boolean;
  readonly terminal: boolean;
}) =>
  Effect.gen(function* () {
    const lines: Array<string> = [];
    yield* printResult({ name: "a.ts" }, options.json, (value, style) =>
      bold(value.name, style),
    ).pipe(
      Effect.provideService(
        Console.Console,
        Object.assign({}, globalThis.console, {
          log: (...values: ReadonlyArray<unknown>) => {
            lines.push(values.map(String).join(" "));
          },
        }),
      ),
      Effect.provide(
        Layer.mergeAll(
          Stdio.layerTest({
            stdoutIsTerminal: Effect.succeed(options.terminal),
          }),
          Layer.succeed(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord({}),
          ),
        ),
      ),
    );
    return lines;
  });

describe("printResult", () => {
  it.effect(
    "writes exactly one JSON line in json mode, even on a terminal",
    () =>
      Effect.gen(function* () {
        expect(yield* printed({ json: true, terminal: true })).toEqual([
          '{"name":"a.ts"}',
        ]);
      }),
  );

  it.effect(
    "writes the rendered text without ANSI when stdout is not a terminal",
    () =>
      Effect.gen(function* () {
        expect(yield* printed({ json: false, terminal: false })).toEqual([
          "a.ts",
        ]);
      }),
  );

  it.effect("styles the rendered text on a terminal", () =>
    Effect.gen(function* () {
      expect(yield* printed({ json: false, terminal: true })).toEqual([
        "\u001B[1ma.ts\u001B[0m",
      ]);
    }),
  );
});
