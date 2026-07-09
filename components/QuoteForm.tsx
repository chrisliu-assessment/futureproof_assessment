"use client";

import type { FormEvent } from "react";
import { useQuoteStore } from "@/lib/store";
import { validateForm } from "@/lib/premium";
import { MATERIALS, type Material, type QuoteFormState } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const numOrNull = (raw: string): number | null => {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export default function QuoteForm() {
  const { state, dispatch } = useQuoteStore();
  const { form, errors, formError, quoteResult, submitting } = state;

  function setField<K extends keyof QuoteFormState>(
    field: K,
    value: QuoteFormState[K],
  ) {
    dispatch({ type: "PATCH_FORM", patch: { [field]: value } as Partial<QuoteFormState> });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    // Client-side validation mirrors the API rules (same pure function).
    const clientErrors = validateForm(form);
    dispatch({ type: "SET_ERRORS", errors: clientErrors });
    if (Object.keys(clientErrors).length > 0) return;

    dispatch({ type: "SET_SUBMITTING", submitting: true });
    dispatch({ type: "SET_FORM_ERROR", message: null });
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) dispatch({ type: "SET_ERRORS", errors: data.errors });
        dispatch({ type: "SET_QUOTE", quote: null });
        dispatch({ type: "SET_FORM_ERROR", message: data.error ?? "Request failed." });
      } else {
        dispatch({ type: "SET_ERRORS", errors: {} });
        dispatch({
          type: "SET_QUOTE",
          quote: { premium: data.premium, breakdown: data.breakdown },
        });
      }
    } catch {
      dispatch({
        type: "SET_FORM_ERROR",
        message: "Network error — is the dev server running?",
      });
    } finally {
      dispatch({ type: "SET_SUBMITTING", submitting: false });
    }
  }

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {/* Address */}
        <Field label="Address" error={errors.address}>
          <input
            type="text"
            className={inputClass}
            value={form.address}
            placeholder="123 Main St, Springfield"
            onChange={(e) => setField("address", e.target.value)}
          />
        </Field>

        {/* Square footage */}
        <Field label="Square footage" error={errors.squareFootage}>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.squareFootage ?? ""}
            placeholder="2000"
            onChange={(e) => setField("squareFootage", numOrNull(e.target.value))}
          />
        </Field>

        {/* Material */}
        <Field label="Building material" error={errors.material}>
          <select
            className={inputClass}
            value={form.material ?? ""}
            onChange={(e) =>
              setField("material", (e.target.value || null) as Material | null)
            }
          >
            <option value="">Select a material…</option>
            {MATERIALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        {/* Coverage */}
        <Field
          label="Coverage amount"
          hint="$50,000 – $500,000"
          error={errors.coverage}
        >
          <input
            type="number"
            className={inputClass}
            value={form.coverage ?? ""}
            placeholder="200000"
            onChange={(e) => setField("coverage", numOrNull(e.target.value))}
          />
        </Field>

        {/* Deductible */}
        <Field
          label="Deductible"
          hint="$1,000 – $5,000"
          error={errors.deductible}
        >
          <input
            type="number"
            className={inputClass}
            value={form.deductible ?? ""}
            placeholder="1000"
            onChange={(e) => setField("deductible", numOrNull(e.target.value))}
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {submitting ? "Getting quote…" : "Get quote"}
        </button>
      </form>

      {/* Top-level / rejection error */}
      {formError && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {formError}
        </div>
      )}

      {/* Quote result */}
      {quoteResult && (
        <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Estimated annual premium
          </p>
          <p className="mt-1 text-3xl font-semibold text-emerald-900 dark:text-emerald-200">
            {money(quoteResult.premium)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
            <dt>Base</dt>
            <dd className="text-right">{money(quoteResult.breakdown.base)}</dd>
            <dt>Risk premium</dt>
            <dd className="text-right">{money(quoteResult.breakdown.riskPremium)}</dd>
            <dt>Deductible factor</dt>
            <dd className="text-right">×{quoteResult.breakdown.deductibleFactor}</dd>
            <dt>Material factor</dt>
            <dd className="text-right">×{quoteResult.breakdown.materialFactor}</dd>
            <dt>Adjusted risk premium</dt>
            <dd className="text-right">
              {money(quoteResult.breakdown.adjustedRiskPremium)}
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {label}
        </span>
        {hint && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{hint}</span>
        )}
      </span>
      <span className="mt-1 block">{children}</span>
      {error && (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}
