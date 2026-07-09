import { NextResponse } from "next/server";
import { recentSubmissions } from "@/lib/db";

// Debug/inspection endpoint: list recent submissions with their quote.
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ submissions: recentSubmissions(20) });
}
