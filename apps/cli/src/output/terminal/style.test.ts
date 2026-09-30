import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Stdio } from "effect";

import { makeStyle, shouldUseColor } from "./style.js";

const colorWhen = (options: {
  readonly terminal: boolean;
  readonly env: Record<string, string>;
}) =>
  shouldUseColor.pipe(
    Effect.provide(
      Layer.mergeAll(
        Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(options.terminal) }),
        Layer.succeed(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord(options.env),
        ),
      ),
    ),
  );

describe("shouldUseColor", () => {
  it.effect("is on for a terminal without NO_COLOR", () =>
    Effect.gen(function* () {
      expect(yield* colorWhen({ terminal: true, env: {} })).toBe(true);
    }),
  );

  it.effect("is off when stdout is not a terminal", () =>
    Effect.gen(function* () {
      expect(yield* colorWhen({ terminal: false, env: {} })).toBe(false);
    }),
  );

  it.effect("is off when NO_COLOR is set", () =>
    Effect.gen(function* () {
      expect(yield* colorWhen({ terminal: true, env: { NO_COLOR: "1" } })).toBe(
        false,
      );
    }),
  );

  it.effect("ignores an empty NO_COLOR", () =>
    Effect.gen(function* () {
      expect(yield* colorWhen({ terminal: true, env: { NO_COLOR: "" } })).toBe(
        true,
      );
    }),
  );
});

describe("makeStyle", () => {
  it("leaves text untouched without color", () => {
    const style = makeStyle(false);

    expect(style.bold("a")).toBe("a");
    expect(style.dim("a")).toBe("a");
    expect(style.heat(0.9, "a")).toBe("a");
  });

  it("colors cool scores green, middle scores yellow and hot scores red", () => {
    const style = makeStyle(true);

    expect(style.heat(0.1, "a")).toBe("\u001B[32ma\u001B[0m");
    expect(style.heat(0.5, "a")).toBe("\u001B[33ma\u001B[0m");
    expect(style.heat(0.66, "a")).toBe("\u001B[31ma\u001B[0m");
  });
});
