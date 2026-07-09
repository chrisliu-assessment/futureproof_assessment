import { NextResponse } from "next/server";
import { calculatePremium, validateForm } from "@/lib/premium";
import { insertQuote } from "@/lib/db";
import type { Material, QuoteFormState } from "@/lib/types";

// better-sqlite3 is a native module — must run on the Node.js runtime.
export const runtime = "nodejs";

// Accept numbers or numeric strings from the client; anything else → null so
// validation produces a clear message rather than NaN.
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const state: Partial<QuoteFormState> = {
    address: typeof body.address === "string" ? body.address : undefined,
    squareFootage: num(body.squareFootage),
    material: (body.material as Material) ?? null,
    coverage: num(body.coverage),
    deductible: num(body.deductible),
  };

  const errors = validateForm(state);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed", errors },
      { status: 400 },
    );
  }

  const { premium, breakdown } = calculatePremium(state as QuoteFormState);
  const { submissionId, quoteId } = insertQuote(state as QuoteFormState, premium);

  return NextResponse.json({ premium, breakdown, submissionId, quoteId });
}
