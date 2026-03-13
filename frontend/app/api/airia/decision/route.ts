import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const pipelineBase = (process.env.PIPELINE_SERVER_URL ?? "http://localhost:4000/process")
    .replace(/\/process$/, "");

  try {
    const res = await fetch(`${pipelineBase}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (data as { error?: string }).error || `Pipeline error (${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pipeline unreachable" },
      { status: 502 }
    );
  }
}
