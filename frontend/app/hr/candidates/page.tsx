"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import HRSidebar from "@/components/HRSidebar";

function useRole() {
  return useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem("hireiq-role"),
    () => null
  );
}

interface JobInfo {
  job_id: string;
  job_title: string;
  department: string;
}

interface CandidateCard {
  application_id: string;
  candidate_name: string;
  status: string;
  applied_at: Date | null;
  overall_score: number | null;
  ai_decision: string | null;
}

type FilterTab = "ALL" | "PROCESSING" | "PENDING" | "APPROVED" | "REJECTED";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ── Status badge ── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PROCESSING: { label: "Processing", bg: "bg-blue-50",   text: "text-blue-600",   dot: "bg-blue-400" },
  PENDING:    { label: "Pending",    bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  APPROVED:   { label: "Approved",   bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  REJECTED:   { label: "Rejected",   bg: "bg-red-50",    text: "text-red-600",    dot: "bg-red-500" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PROCESSING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/* ── AI Decision chip ── */
function DecisionChip({ decision }: { decision: string | null }) {
  if (!decision) return null;
  const isApprove = decision.toUpperCase().includes("APPROVE");
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${isApprove ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
      {isApprove ? "✓ Approve" : "✗ Reject"}
    </span>
  );
}

/* ── Pipeline summary bar ── */
function PipelineBar({ processing, pending, approved, rejected }: { processing: number; pending: number; approved: number; rejected: number }) {
  const total = processing + pending + approved + rejected;
  if (total === 0) return <div className="h-1.5 w-full rounded-full bg-slate-100" />;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      {processing > 0 && <div style={{ width: `${(processing / total) * 100}%` }} className="bg-blue-400" />}
      {approved  > 0 && <div style={{ width: `${(approved  / total) * 100}%` }} className="bg-green-500" />}
      {pending   > 0 && <div style={{ width: `${(pending   / total) * 100}%` }} className="bg-yellow-400" />}
      {rejected  > 0 && <div style={{ width: `${(rejected  / total) * 100}%` }} className="bg-red-500" />}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Candidates List Content
   ══════════════════════════════════════════════ */
function CandidatesContent() {
  const router = useRouter();
  const role = useRole();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [candidates, setCandidates] = useState<CandidateCard[]>([]);
  const [filter, setFilter] = useState<FilterTab>("ALL");

  useEffect(() => {
    if (role !== "hr") return;
    if (!jobId) {
      setError("No job ID provided.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [jobSnap, candidateSnap] = await Promise.all([
          getDoc(doc(db, "jobs", jobId)),
          getDocs(query(collection(db, "candidates"), where("job_id", "==", jobId))),
        ]);

        if (!jobSnap.exists()) {
          setError("Job not found.");
          setLoading(false);
          return;
        }
        const jobData = jobSnap.data();
        setJob({ job_id: jobId, job_title: jobData.job_title || "", department: jobData.department || "" });

        const cards = await Promise.all(
          candidateSnap.docs.map(async (d) => {
            const data = d.data();
            const status = (data.status || "PROCESSING").toUpperCase();
            let overall_score: number | null = null;
            let ai_decision: string | null = null;

            if (status !== "PROCESSING") {
              try {
                const resultSnap = await getDoc(doc(db, "results", data.application_id || d.id));
                if (resultSnap.exists()) {
                  const rData = resultSnap.data() as Record<string, unknown>;
                  overall_score = typeof rData.overall_score === "number" ? rData.overall_score : null;
                  ai_decision   = typeof rData.decision === "string"       ? rData.decision       : null;
                }
              } catch {}
            }

            return {
              application_id: data.application_id || d.id,
              candidate_name: data.candidate_name || "Unknown",
              status,
              applied_at: data.applied_at?.toDate?.() ?? null,
              overall_score,
              ai_decision,
            } as CandidateCard;
          })
        );

        const ORDER: Record<string, number> = { PENDING: 0, PROCESSING: 1, APPROVED: 2, REJECTED: 3 };
        cards.sort((a, b) => {
          const o = (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9);
          if (o !== 0) return o;
          if (!a.applied_at) return 1;
          if (!b.applied_at) return -1;
          return b.applied_at.getTime() - a.applied_at.getTime();
        });

        setCandidates(cards);
      } catch {
        setError("Failed to load candidates.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [jobId, role]);

  if (role !== "hr") {
    if (typeof window !== "undefined") router.replace("/");
    return null;
  }

  const counts = {
    processing: candidates.filter((c) => c.status === "PROCESSING").length,
    pending:    candidates.filter((c) => c.status === "PENDING").length,
    approved:   candidates.filter((c) => c.status === "APPROVED").length,
    rejected:   candidates.filter((c) => c.status === "REJECTED").length,
  };

  const filtered = filter === "ALL" ? candidates : candidates.filter((c) => c.status === filter);

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "ALL",        label: "All",        count: candidates.length },
    { key: "PROCESSING", label: "Processing", count: counts.processing },
    { key: "PENDING",    label: "Pending",    count: counts.pending },
    { key: "APPROVED",   label: "Approved",   count: counts.approved },
    { key: "REJECTED",   label: "Rejected",   count: counts.rejected },
  ];

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-screen">
        <HRSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading candidates...</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !job) {
    return (
      <div className="flex min-h-screen">
        <HRSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <p className="mb-4 text-sm text-red-500">{error || "Job not found."}</p>
            <button
              onClick={() => router.push("/hr/dashboard")}
              className="cursor-pointer rounded-sm border border-blue-200 bg-white px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:bg-blue-50"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <HRSidebar />
      <div className="ml-56 min-h-screen flex-1 bg-white">

        {/* ── Page header ── */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
                  {job.job_title}
                </h1>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {job.department ? `${job.department} · ` : ""}Candidates
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/hr/dashboard")}
              className="cursor-pointer rounded-sm border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-5">
            {[
              {
                label: "Total",
                value: candidates.length,
                sub: "applications",
                color: "text-slate-700",
                bg: "bg-white",
                border: "border-slate-200",
                accent: "bg-slate-400",
              },
              {
                label: "Processing",
                value: counts.processing,
                sub: candidates.length ? `${Math.round((counts.processing / candidates.length) * 100)}% of total` : "—",
                color: "text-blue-600",
                bg: "bg-white",
                border: "border-blue-200",
                accent: "bg-blue-500",
              },
              {
                label: "Pending Review",
                value: counts.pending,
                sub: candidates.length ? `${Math.round((counts.pending / candidates.length) * 100)}% of total` : "—",
                color: "text-yellow-600",
                bg: "bg-white",
                border: "border-yellow-200",
                accent: "bg-yellow-400",
              },
              {
                label: "Approved",
                value: counts.approved,
                sub: candidates.length ? `${Math.round((counts.approved / candidates.length) * 100)}% of total` : "—",
                color: "text-green-600",
                bg: "bg-white",
                border: "border-green-200",
                accent: "bg-green-500",
              },
              {
                label: "Rejected",
                value: counts.rejected,
                sub: candidates.length ? `${Math.round((counts.rejected / candidates.length) * 100)}% of total` : "—",
                color: "text-red-600",
                bg: "bg-white",
                border: "border-red-200",
                accent: "bg-red-500",
              },
            ].map((s) => (
              <div key={s.label} className={`rounded-sm border ${s.border} ${s.bg} px-4 py-3`}>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">{s.label}</p>
                <p className={`mt-1 text-3xl font-black leading-none ${s.color}`} style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>{s.value}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className={`h-0.5 w-5 rounded-full ${s.accent}`} />
                  <span className="text-[9px] font-semibold text-slate-400">{s.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Pipeline bar summary ── */}
          {candidates.length > 0 && (
            <div className="rounded-sm border border-slate-200 bg-white p-4">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Pipeline</p>
              <PipelineBar processing={counts.processing} pending={counts.pending} approved={counts.approved} rejected={counts.rejected} />
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />{counts.processing} processing</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />{counts.pending} pending review</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />{counts.approved} approved</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{counts.rejected} rejected</span>
              </div>
            </div>
          )}

          {/* ── Filter tabs ── */}
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`cursor-pointer rounded-sm px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all ${
                  filter === tab.key
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 rounded-sm px-1 py-0.5 text-[9px] font-black ${filter === tab.key ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── Candidate cards ── */}
          {filtered.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-200 py-16 text-center">
              <p className="mb-1 text-sm font-semibold text-slate-500">No candidates here</p>
              <p className="text-xs text-slate-400">
                {filter === "ALL" ? "No applications received yet." : `No candidates with status "${filter.toLowerCase()}".`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => {
                const isProcessing = c.status === "PROCESSING";
                return (
                  <div
                    key={c.application_id}
                    className="rounded-sm border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm hover:shadow-blue-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Left: candidate info */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2.5">
                          <h3
                            className="text-[16px] font-black text-slate-900 leading-tight"
                            style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
                          >
                            {c.candidate_name}
                          </h3>
                          <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wide text-slate-400">
                            {c.application_id}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <StatusBadge status={c.status} />
                          {c.ai_decision && <DecisionChip decision={c.ai_decision} />}
                          {c.overall_score !== null && (
                            <span className="rounded-sm bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                              Score {c.overall_score}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">Applied {formatDate(c.applied_at)}</span>
                        </div>
                      </div>

                      {/* Right: action button */}
                      {isProcessing ? (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            disabled
                            className="cursor-not-allowed rounded-sm border border-slate-200 bg-slate-50 px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400"
                          >
                            Processing…
                          </button>
                          <span className="text-[9px] font-semibold text-slate-400">AI analysis in progress</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => router.push(`/hr/candidates/${c.application_id}`)}
                          className="cursor-pointer rounded-sm border border-blue-200 bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 transition-all hover:bg-blue-50 active:scale-95"
                        >
                          View Analysis →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HRCandidatesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        </div>
      }
    >
      <CandidatesContent />
    </Suspense>
  );
}
