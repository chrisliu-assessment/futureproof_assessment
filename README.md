# Insurance Quote App

A web page with a form and an LLM chat helper (shared state) that collects
property details and returns an insurance quote. Built with Next.js 16
(App Router), TypeScript, Tailwind, and SQLite.

## Install

```bash
npm install
```

Requires an Anthropic API key for the chat helper (later step):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Run dev

```bash
npm run dev
# http://localhost:3000
```

## Premium rules

- riskPremium = $1 per 10 sqft + $1 per $1,000 of coverage
- × deductible factor: linear 1.0 @ $1,000 → 0.8 @ $5,000
- × material factor: Wood 1.0, Brick 0.8, Steel 0.7 (**Straw is uninsurable**)
- quote = $100 base + adjusted risk premium

Validation: coverage $50k–$500k, deductible $1k–$5k, material ∈ {Straw, Wood, Brick, Steel}.

## API

### `POST /api/quote`

Validates all fields, rejects Straw, computes the premium, and stores the
submission + quote in SQLite. Returns `{ premium, breakdown, submissionId, quoteId }`
or `400 { error, errors }`.

```bash
curl -s http://localhost:3000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{"address":"1 Main St","squareFootage":2000,"material":"Wood","coverage":200000,"deductible":1000}'
# → {"premium":500,"breakdown":{...},"submissionId":1,"quoteId":1}
```

Straw is rejected:

```bash
curl -s http://localhost:3000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{"address":"1 Main St","squareFootage":2000,"material":"Straw","coverage":200000,"deductible":1000}'
# → 400 {"error":"Validation failed","errors":{"material":"Straw buildings are uninsurable ..."}}
```

Out-of-range values are rejected:

```bash
curl -s http://localhost:3000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{"address":"1 Main St","squareFootage":2000,"material":"Wood","coverage":40000,"deductible":6000}'
# → 400 {"error":"Validation failed","errors":{"coverage":"...","deductible":"..."}}
```

### `GET /api/submissions`

Debug endpoint — lists the 20 most recent submissions with their quote.

```bash
curl -s http://localhost:3000/api/submissions
```

## Data

SQLite file lives at `data/quotes.db` (gitignored, created on first write).
Tables: `submissions` (raw input) and `quotes` (`submission_id`, `premium`).

## Submission

### Implemented (P0)

- **Shared state** — one `useReducer` store (`lib/store.tsx`) drives both the
  form and the chat helper; either can update the same `QuoteFormState`.
- **Form** (`components/QuoteForm.tsx`) — all five fields, material dropdown,
  client-side validation, premium + breakdown display.
- **Premium engine** (`lib/premium.ts`) — pure `calculatePremium()` +
  `validateForm()` (coverage $50k–$500k, deductible $1k–$5k, linear deductible
  factor, material factors, **Straw rejected**), with worked examples in
  comments.
- **API** — `POST /api/quote` validates, rejects Straw / out-of-range with a
  clear 400, computes, and persists submission + quote to SQLite;
  `GET /api/submissions` lists recent rows for debugging.
- **Persistence** — SQLite via `better-sqlite3` (`submissions`, `quotes`).
- **Chat helper** (`lib/chat.ts` + `components/ChatPanel.tsx`) — deterministic
  regex/keyword parser: greets with only-missing fields, fills fields from
  free text, never re-asks a populated field, explains Straw is uninsurable,
  and generates the quote through the same `/api/quote` (updating the form
  panel too).

### Deferred (P1/P2, out of the ~1h scope)

- LLM-backed chat (the store/messages are structured to swap one in later).
- Automated tests (premium math is verified by the inline examples + manual
  curl; chat rules verified by a scripted run).
- Streaming chat responses, richer inline field validation, listing past
  quotes in the UI, editing/deleting quotes.
- Auth, multi-property, deployment.

### Known notes

- Field is named `squareFootage` end-to-end (not `sqft`) so client, API, and
  DB share one type with no mapping layer.
- `npm audit` reports advisories in the scaffold's transitive deps; not
  addressed within scope.

### Preparing the archive

Stop the dev server, then remove generated artifacts before zipping:

```bash
# 1. Stop the dev server (Ctrl-C in its terminal, or by PID)
pkill -f "next dev"        # or: kill <pid of next-server>

# 2. Remove generated / regenerable artifacts (all gitignored)
rm -rf node_modules .next data
#   node_modules  — reinstall with `npm install`
#   .next         — rebuilt by `npm run build` / `npm run dev`
#   data/         — SQLite db (quotes.db, -wal, -shm); test data only
```

`package-lock.json` is kept (locks the dependency tree). `next-env.d.ts` and
`*.tsbuildinfo` are gitignored but harmless to leave.
