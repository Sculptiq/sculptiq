import { describe, expect, it } from "vitest";
import {
  compileFormula,
  FORMULA_MAX_LENGTH,
  FORMULA_PRESETS,
  getFormula,
} from "../src/lib/studio/formula";

function evaluate(src: string, vars = { a: 0, t: 0, f: 12 }) {
  const r = compileFormula(src);
  if (!r.ok) throw new Error(`expected “${src}” to compile: ${r.error.message}`);
  return r.fn(vars);
}

function failure(src: string) {
  const r = compileFormula(src);
  expect(r.ok, `expected “${src}” to be rejected`).toBe(false);
  return r.ok ? null : r.error;
}

describe("formula grammar", () => {
  it("does arithmetic with the usual precedence", () => {
    expect(evaluate("1 + 2 * 3")).toBe(7);
    expect(evaluate("(1 + 2) * 3")).toBe(9);
    expect(evaluate("2 ^ 3 ^ 2")).toBe(512); // right associative
    expect(evaluate("-2 ^ 2")).toBe(-4); // unary binds looser than power
    expect(evaluate("7 % 4")).toBe(3);
    expect(evaluate("1.5e2")).toBe(150);
    expect(evaluate(".5 + .25")).toBe(0.75);
  });

  it("reads the pattern variables and constants", () => {
    expect(evaluate("a", { a: 1.5, t: 0.25, f: 9 })).toBe(1.5);
    expect(evaluate("t", { a: 1.5, t: 0.25, f: 9 })).toBe(0.25);
    expect(evaluate("f", { a: 1.5, t: 0.25, f: 9 })).toBe(9);
    expect(evaluate("pi")).toBeCloseTo(Math.PI);
    expect(evaluate("tau")).toBeCloseTo(Math.PI * 2);
  });

  it("supports the maths functions", () => {
    expect(evaluate("sin(0)")).toBe(0);
    expect(evaluate("max(3, 9)")).toBe(9);
    expect(evaluate("clamp(15, 0, 10)")).toBe(10);
    expect(evaluate("lerp(0, 10, 0.25)")).toBe(2.5);
    expect(evaluate("smoothstep(0, 1, 0.5)")).toBe(0.5);
    expect(evaluate("step(0.5, 0.9)")).toBe(1);
    expect(evaluate("sign(-4)")).toBe(-1);
  });

  it("supports comparisons and the ternary", () => {
    expect(evaluate("t > 0.5 ? 1 : -1", { a: 0, t: 0.9, f: 1 })).toBe(1);
    expect(evaluate("t > 0.5 ? 1 : -1", { a: 0, t: 0.1, f: 1 })).toBe(-1);
    expect(evaluate("1 == 1 && 2 != 3")).toBe(1);
    expect(evaluate("0 || 0")).toBe(0);
    expect(evaluate("!0")).toBe(1);
  });

  it("keeps noise smooth and inside -1..1", () => {
    for (let i = 0; i < 200; i++) {
      const v = evaluate(`noise(${i / 7})`);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    // Deterministic: the same input gives the same output.
    expect(evaluate("noise(3.3)")).toBe(evaluate("noise(3.3)"));
  });

  it("compiles every shipped preset", () => {
    for (const preset of FORMULA_PRESETS) {
      const r = compileFormula(preset.source);
      expect(r.ok, `${preset.label} should compile`).toBe(true);
      if (r.ok) {
        for (const t of [0, 0.5, 1]) {
          for (const a of [0, 1, 3, 6.2]) {
            expect(Number.isFinite(r.fn({ a, t, f: 12 }))).toBe(true);
          }
        }
      }
    }
  });
});

describe("formula never produces a poisoned number", () => {
  it("returns 0 instead of dividing by zero", () => {
    expect(evaluate("1 / 0")).toBe(0);
    expect(evaluate("5 % 0")).toBe(0);
  });

  it("returns 0 for undefined maths rather than NaN", () => {
    expect(evaluate("sqrt(-4)")).toBe(0);
    expect(evaluate("log(0)")).toBe(0);
    expect(evaluate("pow(-2, 0.5)")).toBe(0);
    expect(evaluate("0 ^ -1")).toBe(0);
  });

  it("is always finite across the whole sampling domain", () => {
    const r = compileFormula("tan(a * f) / (t - 0.5)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (let i = 0; i <= 100; i++) {
      for (let j = 0; j <= 20; j++) {
        const v = r.fn({ a: (i / 100) * Math.PI * 2, t: j / 20, f: 12 });
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe("formula rejects anything that is not maths", () => {
  it("refuses JavaScript escape hatches", () => {
    const hostile = [
      "fetch('https://evil.test')",
      "window.location",
      "globalThis",
      "constructor",
      "this.constructor('return 1')()",
      "localStorage.getItem('sb-auth')",
      "document.cookie",
      "eval('1')",
      "Function('return 1')()",
      "import('x')",
      "process.env.SUPABASE",
      "require('fs')",
      "a; fetch('x')",
      "a = 1",
      "[1,2,3]",
      "{}",
      "`template`",
      "a?.b",
      "new Date()",
      "(() => 1)()",
    ];
    for (const src of hostile) {
      const err = failure(src);
      expect(err?.message).toBeTruthy();
    }
  });

  it("names the unknown identifier and function", () => {
    expect(failure("wobble")?.message).toContain("wobble");
    expect(failure("wobble(1)")?.message).toContain("wobble");
  });

  it("checks the argument count", () => {
    expect(failure("sin(1, 2)")?.message).toContain("1 value");
    expect(failure("clamp(1)")?.message).toContain("3 values");
  });

  it("reports unbalanced parentheses and dangling operators", () => {
    expect(failure("sin(a")).toBeTruthy();
    expect(failure("1 +")).toBeTruthy();
    expect(failure("* 2")).toBeTruthy();
    expect(failure("1 ? 2")).toBeTruthy();
  });

  it("rejects empty and oversized input", () => {
    expect(failure("")).toBeTruthy();
    expect(failure("   ")).toBeTruthy();
    expect(failure("1+".repeat(FORMULA_MAX_LENGTH) + "1")).toBeTruthy();
  });

  it("points at where the problem is", () => {
    const err = failure("sin(a) + nope");
    expect(err?.index).toBe(9);
  });

  it("does not hang on deeply nested input", () => {
    const started = Date.now();
    const deep = "(".repeat(400) + "1" + ")".repeat(400);
    compileFormula(deep);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("formula cache", () => {
  it("hands back the same compiled result for the same source", () => {
    const a = getFormula("sin(a * f)");
    const b = getFormula("sin(a * f)");
    expect(a).toBe(b);
    expect(a.ok).toBe(true);
  });

  it("caches failures too, without throwing", () => {
    expect(getFormula("nope(").ok).toBe(false);
    expect(getFormula("nope(").ok).toBe(false);
  });
});
