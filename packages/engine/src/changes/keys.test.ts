import { describe, expect, it } from "vitest";

import { pullRequestOf, ticketOf } from "./keys.js";

describe("pullRequestOf", () => {
  it("reads the number a squash merge appends to the subject", () => {
    expect(pullRequestOf("fix(core): handle nulls (#1234)")).toBe("1234");
    expect(pullRequestOf("fix: x (#7)  ")).toBe("7");
  });

  it("ignores a number anywhere but at the end of the subject", () => {
    expect(pullRequestOf("fix: same as #12")).toBeUndefined();
    expect(pullRequestOf("fix (#12) and more")).toBeUndefined();
    expect(pullRequestOf("fix: x (#12a)")).toBeUndefined();
  });
});

describe("ticketOf", () => {
  it("finds a key at the start, in brackets, or after a prefix", () => {
    expect(ticketOf("PROJ-42 add it")).toBe("PROJ-42");
    expect(ticketOf("[PROJ-42] add it")).toBe("PROJ-42");
    expect(ticketOf("feat(api): PROJ-42: add it")).toBe("PROJ-42");
    expect(ticketOf("feat/AB2-7 add it")).toBe("AB2-7");
  });

  it("takes the first key of a subject", () => {
    expect(ticketOf("PROJ-1 and PROJ-2")).toBe("PROJ-1");
  });

  it("does not take a key out of a longer word or from lower case", () => {
    expect(ticketOf("xPROJ-42")).toBeUndefined();
    expect(ticketOf("PROJ-42x")).toBeUndefined();
    expect(ticketOf("proj-42")).toBeUndefined();
    expect(ticketOf("A-1")).toBeUndefined();
  });

  it("skips encodings, hashes, standards, and vulnerability ids", () => {
    expect(ticketOf("fix: UTF-8 handling")).toBeUndefined();
    expect(ticketOf("feat: SHA-256 digests")).toBeUndefined();
    expect(ticketOf("fix CVE-2024-1234")).toBeUndefined();
    expect(ticketOf("fix: UTF-8 in PROJ-5")).toBe("PROJ-5");
  });
});
