// Deterministic chat helper. Pure rules + regex parsing — no LLM calls.
// The panel drives the flow: ask for the first missing field, parse whatever
// the user types, patch the shared form state, and re-ask only for what's
// still missing. When everything valid is present it offers to generate a
// quote via the same /api/quote the form uses.

import {
  COVERAGE_MAX,
  COVERAGE_MIN,
  DEDUCTIBLE_MAX,
  DEDUCTIBLE_MIN,
} from "./premium";
import {
  MATERIALS,
  type Material,
  type QuoteBreakdown,
  type QuoteFormState,
} from "./types";

export const REQUIRED_FIELDS: (keyof QuoteFormState)[] = [
  "address",
  "squareFootage",
  "material",
  "coverage",
  "deductible",
];

// Long labels used when asking for a single field.
export const FIELD_LABELS: Record<keyof QuoteFormState, string> = {
  address: "the property address",
  squareFootage: "the square footage",
  material: "the building material — Straw, Wood, Brick, or Steel",
  coverage: `the coverage amount ($${COVERAGE_MIN.toLocaleString()}–$${COVERAGE_MAX.toLocaleString()})`,
  deductible: `the deductible ($${DEDUCTIBLE_MIN.toLocaleString()}–$${DEDUCTIBLE_MAX.toLocaleString()})`,
};

// Short labels used when listing several missing fields at once.
const SHORT_LABELS: Record<keyof QuoteFormState, string> = {
  address: "address",
  squareFootage: "square footage",
  material: "building material",
  coverage: "coverage amount",
  deductible: "deductible",
};

// A field is "satisfied" only when present AND valid — so Straw or an
// out-of-range number keeps the field on the still-needed list.
export function fieldSatisfied(
  form: QuoteFormState,
  f: keyof QuoteFormState,
): boolean {
  const v = form[f];
  if (v == null || (typeof v === "string" && v.trim() === "")) return false;
  switch (f) {
    case "material":
      return v !== "Straw";
    case "squareFootage":
      return typeof v === "number" && v > 0;
    case "coverage":
      return typeof v === "number" && v >= COVERAGE_MIN && v <= COVERAGE_MAX;
    case "deductible":
      return typeof v === "number" && v >= DEDUCTIBLE_MIN && v <= DEDUCTIBLE_MAX;
    default:
      return true;
  }
}

export function missingFields(form: QuoteFormState): (keyof QuoteFormState)[] {
  return REQUIRED_FIELDS.filter((f) => !fieldSatisfied(form, f));
}

// --- parsing helpers -------------------------------------------------------

const AMOUNT_RE = /\$?\s*([\d][\d,]*(?:\.\d+)?)\s*([kKmM])?/;

const AFFIRMATIVE_RE =
  /\b(yes|yep|yeah|yup|sure|ok|okay|go(?:\s*ahead)?|please|do\s*it|generate|calculate|sounds\s*good|let'?s\s*go)\b/i;

export function isAffirmative(text: string): boolean {
  return AFFIRMATIVE_RE.test(text);
}

function toNumber(numStr: string, suffix: string): number {
  let n = parseFloat(numStr.replace(/,/g, ""));
  if (/k/i.test(suffix)) n *= 1_000;
  else if (/m/i.test(suffix)) n *= 1_000_000;
  return Math.round(n);
}

function firstAmount(text: string): number | null {
  const m = text.match(AMOUNT_RE);
  return m ? toNumber(m[1], m[2] ?? "") : null;
}

// A number that appears shortly after a label word, e.g. "coverage of $100k".
function labeledAmount(text: string, label: RegExp): number | null {
  const re = new RegExp(`(?:${label.source})[^\\d$]{0,12}${AMOUNT_RE.source}`, "i");
  const m = text.match(re);
  return m ? toNumber(m[1], m[2] ?? "") : null;
}

function sqftAmount(text: string): number | null {
  const m = text.match(
    /([\d][\d,]*)\s*(?:sq\.?\s?ft|sqft|sf|square\s*f(?:ee|oo)t(?:age)?)\b/i,
  );
  if (m) return toNumber(m[1], "");
  const m2 = text.match(/(?:footage|size)[^\d]{0,12}([\d][\d,]*)/i);
  if (m2) return toNumber(m2[1], "");
  return null;
}

export interface ParseResult {
  patch: Partial<QuoteFormState>;
  mentionedStraw: boolean;
}

// `expecting` is the field we most recently asked for — a bare number with no
// label is attributed to it.
export function parseMessage(
  text: string,
  expecting: keyof QuoteFormState | null,
): ParseResult {
  const patch: Partial<QuoteFormState> = {};
  const mentionedStraw = /\bstraw\b/i.test(text);

  const mat = MATERIALS.find((m) => new RegExp(`\\b${m}\\b`, "i").test(text));
  if (mat) patch.material = mat as Material;

  const sqft = sqftAmount(text);
  if (sqft != null) patch.squareFootage = sqft;

  const cov = labeledAmount(text, /coverage|cover|insur/);
  if (cov != null) patch.coverage = cov;

  const ded = labeledAmount(text, /deductible|deduct/);
  if (ded != null) patch.deductible = ded;

  // Bare number → the numeric field we just asked for.
  if (
    (expecting === "squareFootage" ||
      expecting === "coverage" ||
      expecting === "deductible") &&
    patch[expecting] == null
  ) {
    const bare = firstAmount(text);
    if (bare != null) patch[expecting] = bare;
  }

  // Address: explicit "address is / located at ..." or, when we asked for it,
  // the whole message (if it isn't just a number/material/affirmation).
  const addrMatch = text.match(
    /(?:address|located(?:\s+at)?|lives?\s+at|property(?:\s+is)?(?:\s+at)?)\s*(?:is|:|at)?\s*(.+)/i,
  );
  if (addrMatch && addrMatch[1].trim()) {
    patch.address = addrMatch[1].trim();
  } else if (
    expecting === "address" &&
    patch.address == null &&
    !mat &&
    sqft == null
  ) {
    const t = text.trim();
    if (t.length >= 3 && !AFFIRMATIVE_RE.test(t) && /[a-zA-Z]/.test(t)) {
      patch.address = t;
    }
  }

  return { patch, mentionedStraw };
}

// --- reply composition -----------------------------------------------------

function humanList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function rangeNote(f: keyof QuoteFormState, value: number): string {
  switch (f) {
    case "coverage":
      return `$${value.toLocaleString()} is outside the coverage range ($${COVERAGE_MIN.toLocaleString()}–$${COVERAGE_MAX.toLocaleString()}).`;
    case "deductible":
      return `$${value.toLocaleString()} is outside the deductible range ($${DEDUCTIBLE_MIN.toLocaleString()}–$${DEDUCTIBLE_MAX.toLocaleString()}).`;
    case "squareFootage":
      return "Square footage must be a positive number.";
    default:
      return "";
  }
}

export function greetingMessage(form: QuoteFormState): string {
  const missing = missingFields(form);
  const intro = "Hi! I'm your quote assistant — I'll help you fill out the form.";
  if (missing.length === 0) {
    return `${intro} I already have everything I need. Want me to generate your quote?`;
  }
  const list = humanList(missing.map((f) => SHORT_LABELS[f]));
  return `${intro} I still need your ${list}. To start, what's ${FIELD_LABELS[missing[0]]}?`;
}

// Build the assistant's reply given the freshly-merged form and what was parsed.
export function botReply(form: QuoteFormState, parse: ParseResult): string {
  const lines: string[] = [];

  // Rule 6: mention Straw's ineligibility before ever quoting.
  if (form.material === "Straw" || parse.mentionedStraw) {
    lines.push(
      "Heads up — straw buildings are uninsurable, so I can't generate a quote for a straw structure. If it's actually Wood, Brick, or Steel, let me know and we'll continue.",
    );
  }

  // Flag any just-entered numeric field that's out of range.
  for (const key of Object.keys(parse.patch) as (keyof QuoteFormState)[]) {
    if (key === "material") continue;
    const v = form[key];
    if (typeof v === "number" && !fieldSatisfied(form, key)) {
      lines.push(rangeNote(key, v));
    }
  }

  const missing = missingFields(form);
  if (missing.length === 0) {
    lines.push("That's everything I need — want me to generate your quote?");
    return lines.join("\n\n");
  }

  const next = missing[0];
  const lead = lines.length === 0 ? "Got it. " : "";
  lines.push(`${lead}What's ${FIELD_LABELS[next]}?`);
  return lines.join("\n\n");
}

// Calls the same endpoint the form uses. Client-safe (fetch).
export async function postQuote(
  form: QuoteFormState,
): Promise<
  | { ok: true; premium: number; breakdown: QuoteBreakdown }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await res.json();
  if (!res.ok) {
    const firstFieldError = data.errors
      ? (Object.values(data.errors)[0] as string | undefined)
      : undefined;
    return { ok: false, error: firstFieldError ?? data.error ?? "Could not generate a quote." };
  }
  return { ok: true, premium: data.premium, breakdown: data.breakdown };
}
