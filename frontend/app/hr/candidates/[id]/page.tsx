"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getHRId } from "@/lib/auth";
import HRSidebar from "@/components/HRSidebar";

function useRole() {
  return useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem("hireiq-role"),
    () => null
  );
}

interface AnalysisBlock {
  score: number;
  strengths: string[];
  weaknesses: string[];
  red_flags: string[];
}

interface ParsedResult {
  overall_score: number;
  decision: string;
  confidence: number;
  reasoning: string;
  resume_analysis: AnalysisBlock;
  github_analysis: AnalysisBlock;
  leetcode_analysis: AnalysisBlock;
  credly_analysis: AnalysisBlock;
  combined_strengths: string[];
  combined_weaknesses: string[];
  combined_red_flags: string[];
}

interface CandidateDoc {
  application_id: string;
  job_id: string;
  candidate_name: string;
  email: string;
  phone: string;
  status: string;
  applied_at: { toDate: () => Date } | null;
}

const emptyAnalysis: AnalysisBlock = { score: 0, strengths: [], weaknesses: [], red_flags: [] };

function parseResult(raw: unknown): ParsedResult {
  const defaults: ParsedResult = {
    overall_score: 0,
    decision: "",
    confidence: 0,
    reasoning: "",
    resume_analysis: emptyAnalysis,
    github_analysis: emptyAnalysis,
    leetcode_analysis: emptyAnalysis,
    credly_analysis: emptyAnalysis,
    combined_strengths: [],
    combined_weaknesses: [],
    combined_red_flags: [],
  };

  if (!raw) return defaults;

  let parsed: Record<string, unknown> = {};

  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return defaults; }
  } else if (typeof raw === "object") {
    parsed = raw as Record<string, unknown>;
  }

  if (typeof parsed.message === "string") {
    try { parsed = JSON.parse(parsed.message); } catch {}
  }
  if (typeof parsed.result === "object" && parsed.result !== null) {
    parsed = parsed.result as Record<string, unknown>;
  }

  function toAnalysis(v: unknown): AnalysisBlock {
    if (!v || typeof v !== "object") return emptyAnalysis;
    const o = v as Record<string, unknown>;
    return {
      score: typeof o.score === "number" ? o.score : 0,
      strengths: Array.isArray(o.strengths) ? o.strengths.map(String) : [],
      weaknesses: Array.isArray(o.weaknesses) ? o.weaknesses.map(String) : [],
      red_flags: Array.isArray(o.red_flags) ? o.red_flags.map(String) : [],
    };
  }

  return {
    overall_score: typeof parsed.overall_score === "number" ? parsed.overall_score : 0,
    decision: typeof parsed.decision === "string" ? parsed.decision : "",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    resume_analysis: toAnalysis(parsed.resume_analysis),
    github_analysis: toAnalysis(parsed.github_analysis),
    leetcode_analysis: toAnalysis(parsed.leetcode_analysis),
    credly_analysis: toAnalysis(parsed.credly_analysis),
    combined_strengths: Array.isArray(parsed.combined_strengths) ? parsed.combined_strengths.map(String) : [],
    combined_weaknesses: Array.isArray(parsed.combined_weaknesses) ? parsed.combined_weaknesses.map(String) : [],
    combined_red_flags: Array.isArray(parsed.combined_red_flags) ? parsed.combined_red_flags.map(String) : [],
  };
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function ScoreArc({ score }: { score: number }) {
  const r = 68;
  const cx = 84;
  const cy = 76;
  const semi = Math.PI * r;
  const filled = (score / 100) * semi;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div className="flex flex-col items-center">
      <svg width="168" height="82" viewBox="0 0 168 82">
        <path d={d} fill="none" stroke="#f1f5f9" strokeWidth="13" strokeLinecap="round" />
        <path d={d} fill="none" stroke={color} strokeWidth="13" strokeLinecap="round"
          strokeDasharray={`${filled} ${semi}`} strokeDashoffset="0" />
      </svg>
      <div className="-mt-2 flex flex-col items-center">
        <span className="text-6xl font-black leading-none" style={{ color, fontFamily: "var(--font-rajdhani), sans-serif" }}>{score}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? "bg-green-500" : value >= 50 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="w-full space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Confidence</span>
        <span className="text-3xl font-black leading-none text-indigo-600" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>{value}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100">
        <div className={`h-2.5 rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}


export default function CandidateAnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const role = useRole();
  const applicationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateDoc | null>(null);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [rawResult, setRawResult] = useState<unknown>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState("");
  const [acting, setActing] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"APPROVED" | "REJECTED" | null>(null);

  useEffect(() => {
    if (role !== "hr") return;
    if (!applicationId) {
      setError("No application ID.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const candidateSnap = await getDoc(doc(db, "candidates", applicationId));
        if (!candidateSnap.exists()) {
          setError("Candidate not found.");
          setLoading(false);
          return;
        }
        const cData = candidateSnap.data() as CandidateDoc;
        setCandidate(cData);
        setStatus(cData.status || "PROCESSING");

        if (cData.job_id) {
          const jobSnap = await getDoc(doc(db, "jobs", cData.job_id));
          if (jobSnap.exists()) setJobTitle(jobSnap.data().job_title || "");
        }

        const resultSnap = await getDoc(doc(db, "results", applicationId));
        if (resultSnap.exists()) {
          const rData = resultSnap.data();
          setRawResult(rData);
          setResult(parseResult(rData));
        }
      } catch {
        setError("Failed to load analysis data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [applicationId, role]);

  if (role !== "hr") {
    if (typeof window !== "undefined") router.replace("/");
    return null;
  }

  async function executeDecision(action: "APPROVED" | "REJECTED") {
    if (!candidate) return;
    setActing(true);
    setActionMsg(null);
    setConfirmAction(null);

    try {
      const res = await fetch("/api/airia/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          jobId: candidate.job_id,
          action,
          resultJson: rawResult,
          hrId: getHRId() ?? "",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      setStatus(action);
      setActionMsg(
        action === "APPROVED"
          ? "Candidate approved. Email sent successfully."
          : "Candidate rejected. Feedback email sent."
      );
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <HRSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading analysis...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex min-h-screen">
        <HRSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <p className="mb-4 text-sm text-red-500">{error || "Not found."}</p>
            <button
              onClick={() => router.back()}
              className="cursor-pointer rounded-sm border border-blue-200 bg-white px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:bg-blue-50"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isApprove = result?.decision?.toUpperCase().includes("APPROVE");

  return (
    <div className="flex min-h-screen">
      <HRSidebar />
      <div className="ml-56 min-h-screen flex-1 bg-white">

        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div>
                <h1
                  className="text-[18px] font-black uppercase leading-none tracking-widest text-blue-600"
                  style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
                >
                  {candidate.candidate_name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[10px] text-slate-500">{candidate.email}</span>
                  {candidate.phone && <span className="text-[10px] text-slate-400">· {candidate.phone}</span>}
                  {jobTitle && <span className="text-[10px] text-slate-400">· {jobTitle}</span>}
                  <span className="text-[10px] text-slate-400">· Applied {formatDate(candidate.applied_at?.toDate?.() ?? null)}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusChip status={status} />
              <button
                onClick={() => router.back()}
                className="cursor-pointer rounded-sm border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">

          <div className="rounded-sm border border-slate-200 bg-white p-5">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Candidate Info</p>
            <div className="mb-4 flex items-center gap-1.5">
              <div className="h-0.5 w-6 rounded-full bg-blue-600" />
              <div className="h-0.5 w-2 rounded-full bg-blue-300" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Full Name</p>
                <p className="mt-0.5 text-[13px] font-black text-slate-800" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>{candidate.candidate_name}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Email</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-700 break-all">{candidate.email}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Phone</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-700">{candidate.phone || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Job Title</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-700">{jobTitle || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Applied</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-700">{formatDate(candidate.applied_at?.toDate?.() ?? null)}</p>
              </div>
            </div>
          </div>

          {!result ? (
            <div className="rounded-sm border border-dashed border-slate-200 py-16 text-center">
              <p className="text-sm font-semibold text-slate-500">Analysis results not available yet.</p>
              <p className="mt-1 text-xs text-slate-400">Check back after processing completes.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                <div className={`flex flex-col items-center justify-center rounded-sm border px-8 py-6 gap-3 ${isApprove ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"}`}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Overall Score</p>
                  <ScoreArc score={result.overall_score} />
                  <div className={`flex items-center gap-2 rounded-sm px-4 py-2 ${isApprove ? "bg-green-500" : "bg-red-500"}`}>
                    {isApprove ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    )}
                    <span className="text-[12px] font-black uppercase tracking-widest text-white" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                      AI Recommends: {isApprove ? "Approve" : "Reject"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col justify-center rounded-sm border border-slate-200 bg-white px-6 py-6">
                  <ConfidenceBar value={result.confidence} />
                  {result.reasoning && (
                    <p className="mt-4 text-[11px] leading-relaxed text-slate-500 border-t border-slate-100 pt-3">
                      {result.reasoning}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <AnalysisCard title="Resume"   icon="📄" data={result.resume_analysis} />
                <AnalysisCard title="GitHub"   icon="💻" data={result.github_analysis} />
                <AnalysisCard title="LeetCode" icon="🧩" data={result.leetcode_analysis} />
                <AnalysisCard title="Credly"   icon="🏅" data={result.credly_analysis} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
                  <div className="flex items-center justify-between bg-green-500 px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white">Strengths</p>
                    </div>
                    <span className="rounded-sm bg-green-400 px-1.5 py-0.5 text-[9px] font-bold text-white">{result.combined_strengths.length}</span>
                  </div>
                  <ul className="divide-y divide-slate-100 p-0">
                    {result.combined_strengths.length === 0 ? (
                      <li className="px-4 py-3 text-xs text-slate-400">None listed</li>
                    ) : result.combined_strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2.5 px-4 py-2.5 text-[11px] leading-relaxed text-slate-700">
                        <span className="mt-0.5 shrink-0 text-[13px] font-black text-green-500">+</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
                  <div className="flex items-center justify-between bg-yellow-400 px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white">Weaknesses</p>
                    </div>
                    <span className="rounded-sm bg-yellow-300 px-1.5 py-0.5 text-[9px] font-bold text-white">{result.combined_weaknesses.length}</span>
                  </div>
                  <ul className="divide-y divide-slate-100 p-0">
                    {result.combined_weaknesses.length === 0 ? (
                      <li className="px-4 py-3 text-xs text-slate-400">None listed</li>
                    ) : result.combined_weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2.5 px-4 py-2.5 text-[11px] leading-relaxed text-slate-700">
                        <span className="mt-0.5 shrink-0 text-[13px] font-black text-yellow-500">−</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">

                  <div className="flex items-center justify-between bg-red-500 px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white">Red Flags</p>
                    </div>
                    <span className="rounded-sm bg-red-400 px-1.5 py-0.5 text-[9px] font-bold text-white">{result.combined_red_flags.length}</span>
                  </div>
                  <ul className="divide-y divide-slate-100 p-0">
                    {result.combined_red_flags.length === 0 ? (
                      <li className="px-4 py-3 text-xs text-slate-400">No red flags</li>
                    ) : result.combined_red_flags.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 px-4 py-2.5 text-[11px] font-medium leading-relaxed text-slate-700">
                        <span className="mt-0.5 shrink-0 text-[13px] font-black text-red-500">!</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {status === "PENDING" && (
            <div className="rounded-sm border border-slate-200 bg-white p-5">
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Decision</p>

              {actionMsg && (
                <div className="mb-4 rounded-sm border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                  {actionMsg}
                </div>
              )}

              {confirmAction ? (
                <div>
                  <p className="mb-4 text-sm text-slate-700">
                    Confirm{" "}
                    <span className={`font-bold ${confirmAction === "APPROVED" ? "text-green-600" : "text-red-600"}`}>
                      {confirmAction === "APPROVED" ? "APPROVE" : "REJECT"}
                    </span>{" "}
                    for <span className="font-semibold text-slate-900">{candidate.candidate_name}</span>?
                  </p>
                  <div className="flex gap-3">
                    <button
                      disabled={acting}
                      onClick={() => executeDecision(confirmAction)}
                      className={`cursor-pointer rounded-sm px-5 py-2.5 text-[12px] font-bold uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 ${
                        confirmAction === "APPROVED"
                          ? "bg-green-600 shadow-md shadow-green-200 hover:bg-green-700"
                          : "bg-red-600 shadow-md shadow-red-200 hover:bg-red-700"
                      }`}
                    >
                      {acting ? "Processing..." : "Yes, Confirm"}
                    </button>
                    <button
                      disabled={acting}
                      onClick={() => setConfirmAction(null)}
                      className="cursor-pointer rounded-sm border border-slate-200 bg-white px-5 py-2.5 text-[12px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmAction("APPROVED")}
                    className="cursor-pointer rounded-sm bg-green-600 px-5 py-2.5 text-[12px] font-bold uppercase tracking-widest text-white shadow-md shadow-green-200 transition-all hover:bg-green-700 active:scale-95"
                  >
                    Approve Candidate
                  </button>
                  <button
                    onClick={() => setConfirmAction("REJECTED")}
                    className="cursor-pointer rounded-sm bg-red-600 px-5 py-2.5 text-[12px] font-bold uppercase tracking-widest text-white shadow-md shadow-red-200 transition-all hover:bg-red-700 active:scale-95"
                  >
                    Reject Candidate
                  </button>
                </div>
              )}
            </div>
          )}

          {status !== "PENDING" && actionMsg && (
            <div className="rounded-sm border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {actionMsg}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    PROCESSING: { label: "Processing", bg: "bg-blue-50 border border-blue-100",   text: "text-blue-600" },
    PENDING:    { label: "Pending",    bg: "bg-yellow-50 border border-yellow-200", text: "text-yellow-700" },
    APPROVED:   { label: "Approved",   bg: "bg-green-50 border border-green-200",   text: "text-green-700" },
    REJECTED:   { label: "Rejected",   bg: "bg-red-50 border border-red-200",       text: "text-red-700" },
    ERROR:      { label: "Error",      bg: "bg-slate-100 border border-slate-200",  text: "text-slate-500" },
  };
  const cfg = map[status] || map.PROCESSING;
  return (
    <span className={`rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function AnalysisCard({ title, icon, data }: { title: string; icon: string; data: AnalysisBlock }) {
  const color = data.score >= 75 ? "bg-green-500" : data.score >= 50 ? "bg-yellow-400" : "bg-red-500";
  const textColor = data.score >= 75 ? "text-green-600" : data.score >= 50 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-[12px] font-black uppercase tracking-wider text-slate-700" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>{title}</span>
        </div>
        <span className={`text-[14px] font-black ${textColor}`} style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>{data.score}</span>
      </div>

      <div className="mb-3 h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${data.score}%` }} />
      </div>
    </div>
  );
}
