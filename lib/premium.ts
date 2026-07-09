// Pure premium math + validation. No I/O — trivially unit-testable.
//
// Rules (from the spec):
//   1. riskPremium   = $1 per 10 sqft  +  $1 per $1,000 of coverage
//   2. deductibleFactor: linear 1.0 @ $1,000 → 0.8 @ $5,000 (higher deductible, lower premium)
//   3. materialFactor:  Wood 1.0, Brick 0.8, Steel 0.7; Straw is uninsurable (rejected)
//   4. quote = $100 base + (riskPremium * deductibleFactor * materialFactor)

import type {
  Material,
  QuoteBreakdown,
  QuoteFormState,
  QuoteResult,
} from "./types";

export const COVERAGE_MIN = 50_000;
export const COVERAGE_MAX = 500_000;
export const DEDUCTIBLE_MIN = 1_000;
export const DEDUCTIBLE_MAX = 5_000;
export const BASE_PREMIUM = 100;

const MATERIAL_FACTOR: Record<Exclude<Material, "Straw">, number> = {
  Wood: 1.0,
  Brick: 0.8,
  Steel: 0.7,
};

export type ValidationErrors = Partial<Record<keyof QuoteFormState, string>>;

// Field-level validation. Straw is surfaced here as a material error so the
// caller gets a clear, specific rejection message.
export function validateForm(s: Partial<QuoteFormState>): ValidationErrors {
  const e: ValidationErrors = {};

  if (!s.address || !s.address.trim()) {
    e.address = "Address is required.";
  }

  if (s.squareFootage == null || !Number.isFinite(s.squareFootage) || s.squareFootage <= 0) {
    e.squareFootage = "Square footage must be a positive number.";
  }

  if (s.material == null) {
    e.material = "Building material is required.";
  } else if (!MATERIALS_INTERNAL.includes(s.material)) {
    e.material = "Material must be Straw, Wood, Brick, or Steel.";
  } else if (s.material === "Straw") {
    e.material = "Straw buildings are uninsurable and cannot be quoted.";
  }

  if (s.coverage == null || s.coverage < COVERAGE_MIN || s.coverage > COVERAGE_MAX) {
    e.coverage = `Coverage must be between $${COVERAGE_MIN.toLocaleString()} and $${COVERAGE_MAX.toLocaleString()}.`;
  }

  if (
    s.deductible == null ||
    s.deductible < DEDUCTIBLE_MIN ||
    s.deductible > DEDUCTIBLE_MAX
  ) {
    e.deductible = `Deductible must be between $${DEDUCTIBLE_MIN.toLocaleString()} and $${DEDUCTIBLE_MAX.toLocaleString()}.`;
  }

  return e;
}

const MATERIALS_INTERNAL: Material[] = ["Straw", "Wood", "Brick", "Steel"];

// Linear interpolation: 1.0 at $1,000, 0.8 at $5,000.
//   factor = 1.0 - 0.2 * (deductible - 1000) / (5000 - 1000)
//   $1,000 → 1.0 ; $3,000 → 0.9 ; $5,000 → 0.8
export function deductibleFactor(deductible: number): number {
  return 1.0 - (0.2 * (deductible - DEDUCTIBLE_MIN)) / (DEDUCTIBLE_MAX - DEDUCTIBLE_MIN);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Assumes `s` has already passed validateForm() (all fields present, non-Straw).
//
// Worked examples (the math the tests would assert):
//   • 2000 sqft, $200,000, $1,000, Wood:
//       risk = 2000/10 + 200000/1000 = 200 + 200 = 400
//       400 * 1.0 * 1.0 = 400  →  100 + 400 = $500.00
//   • 2500 sqft, $300,000, $5,000, Steel:
//       risk = 250 + 300 = 550 ; ded = 0.8 ; mat = 0.7
//       550 * 0.8 * 0.7 = 308  →  100 + 308 = $408.00
//   • 1000 sqft, $100,000, $3,000, Brick:
//       risk = 100 + 100 = 200 ; ded = 0.9 ; mat = 0.8
//       200 * 0.9 * 0.8 = 144  →  100 + 144 = $244.00
export function calculatePremium(s: QuoteFormState): QuoteResult {
  const material = s.material as Exclude<Material, "Straw">;
  const riskPremium = s.squareFootage! / 10 + s.coverage! / 1000;
  const dedFactor = deductibleFactor(s.deductible!);
  const matFactor = MATERIAL_FACTOR[material];
  const adjustedRiskPremium = riskPremium * dedFactor * matFactor;
  const premium = round2(BASE_PREMIUM + adjustedRiskPremium);

  const breakdown: QuoteBreakdown = {
    base: BASE_PREMIUM,
    riskPremium: round2(riskPremium),
    deductibleFactor: round2(dedFactor),
    materialFactor: matFactor,
    adjustedRiskPremium: round2(adjustedRiskPremium),
  };

  return { premium, breakdown };
}
