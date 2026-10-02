import { defineConfig } from "vitest/config";

export default defineConfig({
  root: new URL(".", import.meta.url).pathname,
  test: {
    include: ["scripts/**/*.test.ts"],
    passWithNoTests: true,
    // These tests spawn oxlint, git and the packed CLI; under load one spawn
    // can take longer than vitest's 5 s default without anything being wrong.
    testTimeout: 60_000,
  },
});
