import { describe, expect, it } from "vitest";
import { evaluateExpression } from "@/lib/mapping-expression";

describe("evaluateExpression", () => {
  const ctx = {
    name: "Astra",
    details: { city: "Paris" },
    tokens: [100, 50, 25],
    values: ["one", "two"],
  };

  it("resolves plain identifiers", () => {
    expect(evaluateExpression("name", ctx)).toBe("Astra");
  });

  it("resolves nested paths", () => {
    expect(evaluateExpression("details.city", ctx)).toBe("Paris");
  });

  it("supports literals", () => {
    expect(evaluateExpression("'hello'", ctx)).toBe("hello");
    expect(evaluateExpression("42", ctx)).toBe(42);
  });

  it("runs helpers", () => {
    expect(evaluateExpression("upper(name)", ctx)).toBe("ASTRA");
    expect(evaluateExpression("coalesce('', details.city)", ctx)).toBe("Paris");
    expect(evaluateExpression("join(values, ', ')", ctx)).toBe("one, two");
    expect(evaluateExpression("sum(tokens)", ctx)).toBe(175);
  });
});
