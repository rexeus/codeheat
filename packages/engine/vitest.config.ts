import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests build real git repositories commit by commit; under
    // turbo's parallel load one can take longer than vitest's 5 s default
    // without anything being wrong.
    testTimeout: 60_000,
  },
});
