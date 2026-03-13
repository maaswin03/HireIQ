import { NextRequest, NextResponse } from "next/server";

/**
 * Thin forwarder — receives { application_id, job_id, user_id } from the browser
 * and forwards to the standalone pipeline server. Returns 200 immediately so the
 * browser (and user) are never blocked. The pipeline server runs independently.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const pipelineUrl =
    process.env.PIPELINE_SERVER_URL ?? "http://localhost:4000/process";

  // Fire and forget — do not await
  fetch(pipelineUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => console.error("[apply] Failed to reach pipeline server:", err));

  return NextResponse.json({ success: true });
}
