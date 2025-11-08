import { NextResponse } from "next/server";
import { listApprovals, resolveApproval } from "@/server/approval-inbox";

export async function GET() {
  return NextResponse.json({ approvals: listApprovals() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; action?: "approve" | "reject"; note?: string };
  if (!body.id || !body.action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }
  resolveApproval(body.id, body.action === "approve" ? "approved" : "rejected", body.note);
  return NextResponse.json({ ok: true });
}
