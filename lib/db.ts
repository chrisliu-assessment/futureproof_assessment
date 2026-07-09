// SQLite persistence (better-sqlite3). Stores each submitted property and its
// resulting quote. A submission is the raw input; a quote is the priced result,
// linked by submission_id (one quote per submission here).

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { QuoteFormState } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "quotes.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      address        TEXT    NOT NULL,
      square_footage INTEGER NOT NULL,
      material       TEXT    NOT NULL,
      coverage       INTEGER NOT NULL,
      deductible     INTEGER NOT NULL,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      premium       REAL    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  _db = db;
  return _db;
}

// Insert the submission and its quote atomically. Returns the new row ids.
export function insertQuote(
  s: QuoteFormState,
  premium: number,
): { submissionId: number; quoteId: number } {
  const db = getDb();
  const tx = db.transaction(() => {
    const sub = db
      .prepare(
        `INSERT INTO submissions (address, square_footage, material, coverage, deductible)
         VALUES (@address, @squareFootage, @material, @coverage, @deductible)`,
      )
      .run({
        address: s.address,
        squareFootage: s.squareFootage,
        material: s.material,
        coverage: s.coverage,
        deductible: s.deductible,
      });
    const submissionId = Number(sub.lastInsertRowid);

    const q = db
      .prepare(`INSERT INTO quotes (submission_id, premium) VALUES (?, ?)`)
      .run(submissionId, premium);

    return { submissionId, quoteId: Number(q.lastInsertRowid) };
  });
  return tx();
}

export interface SubmissionRow {
  id: number;
  address: string;
  square_footage: number;
  material: string;
  coverage: number;
  deductible: number;
  created_at: string;
  premium: number | null;
  quote_id: number | null;
}

// Recent submissions joined to their quote — for the debug endpoint.
export function recentSubmissions(limit = 20): SubmissionRow[] {
  return getDb()
    .prepare(
      `SELECT s.*, q.premium AS premium, q.id AS quote_id
         FROM submissions s
         LEFT JOIN quotes q ON q.submission_id = s.id
        ORDER BY s.id DESC
        LIMIT ?`,
    )
    .all(limit) as SubmissionRow[];
}
