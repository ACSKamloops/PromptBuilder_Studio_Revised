import { NextResponse } from "next/server";
import { listRuns } from "@/server/run-ledger";

export async function GET() {
  return NextResponse.json({ runs: listRuns() });
}
