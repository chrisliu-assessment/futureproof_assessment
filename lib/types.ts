// Shared types used by the form UI, the chat helper, and the API layer.

export type Material = "Straw" | "Wood" | "Brick" | "Steel";

export const MATERIALS: readonly Material[] = ["Straw", "Wood", "Brick", "Steel"];

// The single source of truth for what the form collects. The chat helper edits
// this same shape so form + chat stay in sync.
export interface QuoteFormState {
  address: string;
  squareFootage: number | null;
  material: Material | null;
  coverage: number | null; // 50,000–500,000
  deductible: number | null; // 1,000–5,000
}

// How a premium was derived — returned to the client so the quote is explainable.
export interface QuoteBreakdown {
  base: number; // flat $100 base
  riskPremium: number; // $1 / 10 sqft + $1 / $1,000 coverage
  deductibleFactor: number; // 1.0 @ $1k … 0.8 @ $5k
  materialFactor: number; // Wood 1.0 / Brick 0.8 / Steel 0.7
  adjustedRiskPremium: number; // riskPremium * deductibleFactor * materialFactor
}

export interface QuoteResult {
  premium: number;
  breakdown: QuoteBreakdown;
}
