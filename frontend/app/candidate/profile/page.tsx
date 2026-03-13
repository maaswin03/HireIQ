"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import CandidateSidebar from "@/components/CandidateSidebar";

interface CandidateInfo {
  candidate_name: string;
  email: string;
  phone: string;
  github_username: string;
  leetcode_username: string;
}

interface ApplicationCard {
  application_id: string;
  job_id: string;
  job_title: string;
  status: string;
  applied_at: Date | null;
}

function useCandidateId(): string {
  return useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem("hireiq-candidate-id") ?? "",
    () => ""
  );
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PROCESSING: { label: "Processing", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  PENDING:    { label: "Pending",    bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  APPROVED:   { label: "Approved",   bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  REJECTED:   { label: "Rejected",   bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PROCESSING;
  return (
    <span className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function CandidateProfilePage() {
  const router = useRouter();
  const candidateId = useCandidateId();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidateInfo | null>(null);
  const [applications, setApplications] = useState<ApplicationCard[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const role = localStorage.getItem("hireiq-role");
    if (role !== "candidate") {
      router.replace("/");
      return;
    }
    if (!candidateId) {
      setError("No candidate session found. Please apply for a job first.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        // Query all candidate docs matching this user_id
        const q = query(collection(db, "candidates"), where("user_id", "==", candidateId));
        const snap = await getDocs(q);

        if (snap.empty) {
          setError("No applications found for this email.");
          setLoading(false);
          return;
        }

        // Use the first doc for profile info
        const firstDoc = snap.docs[0].data();
        setProfile({
          candidate_name: firstDoc.candidate_name || "",
          email: firstDoc.email || "",
          phone: firstDoc.phone || "",
          github_username: firstDoc.github_username || "",
          leetcode_username: firstDoc.leetcode_username || "",
        });

        // Build application cards — fetch job titles in parallel
        const cards = await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data();
            let jobTitle = "Unknown Position";
            try {
              const jobSnap = await getDoc(doc(db, "jobs", data.job_id));
              if (jobSnap.exists()) jobTitle = jobSnap.data().job_title || jobTitle;
            } catch {
              // keep default
            }
            return {
              application_id: data.application_id || d.id,
              job_id: data.job_id || "",
              job_title: jobTitle,
              status: data.status || "PROCESSING",
              applied_at: data.applied_at?.toDate?.() ?? null,
            } as ApplicationCard;
          })
        );

        // Sort newest first
        cards.sort((a, b) => {
          if (!a.applied_at) return 1;
          if (!b.applied_at) return -1;
          return b.applied_at.getTime() - a.applied_at.getTime();
        });

        setApplications(cards);
      } catch {
        setError("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [candidateId, mounted, router]);

  if (!mounted) return null;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-screen">
        <CandidateSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error / no data ── */
  if (error || !profile) {
    return (
      <div className="flex min-h-screen">
        <CandidateSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <p className="mb-4 text-sm text-red-500">{error || "Profile not found."}</p>
            <button
              onClick={() => router.push("/")}
              className="cursor-pointer rounded-sm border border-blue-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:bg-blue-50"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Profile Page ── */
  return (
    <div className="flex min-h-screen">
      <CandidateSidebar />
      <div className="ml-56 min-h-screen flex-1 bg-white">

        {/* Page header */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-[18px] font-black uppercase leading-none tracking-widest text-blue-600" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                My Profile
              </h1>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {applications.length} application{applications.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <div className="h-0.5 w-6 rounded-full bg-blue-600" />
            <div className="h-0.5 w-2 rounded-full bg-blue-300" />
            <div className="h-0.5 w-1 rounded-full bg-blue-200" />
          </div>
        </div>

        <div className="px-6 py-5">
          {/* ── Profile Info ── */}
          <section className="mb-6">
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Candidate Info</p>
            <div className="rounded-sm border border-slate-200 bg-white p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileField label="Full Name" value={profile.candidate_name} />
                <ProfileField label="Email" value={profile.email} />
                <ProfileField label="Phone" value={profile.phone} />
                <ProfileField label="GitHub Username" value={profile.github_username} />
                <ProfileField label="LeetCode Username" value={profile.leetcode_username} />
              </div>
            </div>
          </section>

          {/* ── Applications ── */}
          <section>
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Applications</p>
            {applications.length === 0 ? (
              <div className="rounded-sm border border-dashed border-slate-200 py-12 text-center">
                <p className="text-sm font-semibold text-slate-500">No applications yet</p>
                <p className="mt-1 text-xs text-slate-400">Browse open jobs and apply</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.application_id}
                    className="rounded-sm border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm hover:shadow-blue-50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="text-[15px] font-black text-slate-900"
                          style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
                        >
                          {app.job_title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          <span className="font-mono font-bold text-blue-600">{app.application_id}</span>
                          <span>· Applied {formatDate(app.applied_at)}</span>
                        </div>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value || "—"}</p>
    </div>
  );
}
