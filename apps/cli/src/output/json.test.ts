import { describe, expect, it } from "vitest";

import { renderJson } from "./json.js";

describe("renderJson", () => {
  it("renders one line that parses back to the exact value", () => {
    const value = { path: "a\u001B[31m\nb\u007F\u0085 .ts", n: [1, 2] };

    const text = renderJson(value);

    expect(text).not.toContain("\n");
    expect(JSON.parse(text)).toEqual(value);
  });

  it("escapes characters a terminal would act on", () => {
    const text = renderJson({ path: "a\u001Bb\u007Fc\u0085d" });

    expect(text).toBe('{"path":"a\\u001bb\\u007fc\\u0085d"}');
  });
});
