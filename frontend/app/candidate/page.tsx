"use client";

import { useEffect, useState, useSyncExternalStore, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CandidateSidebar from "@/components/CandidateSidebar";

function useRole() {
  return useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem("hireiq-role"),
    () => null
  );
}

interface JobListing {
  job_id: string;
  job_title: string;
  company_name: string;
  company_about: string;
  department: string;
  experience_level: string;
  job_type: string;
  work_mode: string;
  location: string;
  job_description: string;
  required_skills: string[];
  openings: number;
  posted_at: { toDate: () => Date } | null;
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500",
  "bg-rose-500",  "bg-amber-500",  "bg-teal-500",
];
function avatarBg(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function daysAgo(d: Date | null): string {
  if (!d) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "1d ago";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const WORK_MODE_FILTERS = [
  { label: "All",     value: "" },
  { label: "Remote",  value: "Remote" },
  { label: "Hybrid",  value: "Hybrid" },
  { label: "On-site", value: "On-site" },
];

const JOB_TYPE_FILTERS = [
  { label: "All",        value: "" },
  { label: "Full-time",  value: "Full-time" },
  { label: "Part-time",  value: "Part-time" },
  { label: "Contract",   value: "Contract" },
  { label: "Internship", value: "Internship" },
];

export default function CandidatePortal() {
  const router = useRouter();
  const role = useRole();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [jobType, setJobType] = useState("");
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() =>
    jobs.filter((j) => {
      const q = search.toLowerCase();
      const matchSearch = !q || j.job_title.toLowerCase().includes(q) || j.department.toLowerCase().includes(q);
      const matchMode = !workMode || j.work_mode === workMode;
      const matchType = !jobType || j.job_type === jobType;
      return matchSearch && matchMode && matchType;
    }),
  [jobs, search, workMode, jobType]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (role !== "candidate") return;
    async function load() {
      try {
        const candidateId = localStorage.getItem("hireiq-candidate-id") ?? "";
        const [jobsSnap, appliedSnap] = await Promise.all([
          getDocs(query(collection(db, "jobs"), orderBy("posted_at", "desc"))),
          candidateId
            ? getDocs(query(collection(db, "candidates"), where("user_id", "==", candidateId)))
            : Promise.resolve(null),
        ]);
        setJobs(
          jobsSnap.docs.map((d) => {
            const data = d.data();
            return {
              job_id: data.job_id || d.id,
              job_title: data.job_title || "",
              company_name: data.company_name || "",
              company_about: data.company_about || "",
              department: data.department || "",
              experience_level: data.experience_level || "",
              job_type: data.job_type || "",
              work_mode: data.work_mode || "",
              location: data.location || "",
              job_description: data.job_description || "",
              required_skills: Array.isArray(data.required_skills) ? data.required_skills : [],
              openings: typeof data.openings === "number" ? data.openings : 0,
              posted_at: data.posted_at ?? null,
            };
          })
        );
        if (appliedSnap) {
          setAppliedJobIds(new Set(appliedSnap.docs.map((d) => d.data().job_id as string)));
        }
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [role, mounted]);

  if (!mounted) return null;

  if (role !== "candidate") {
    router.replace("/");
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <CandidateSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <CandidateSidebar />
      <div className="ml-56 min-h-screen flex-1 bg-white">

        {/* Page header */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="1" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <div>
              <h1 className="text-[18px] font-black uppercase leading-none tracking-widest text-blue-600" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                Browse Jobs
              </h1>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {jobs.length} open position{jobs.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">

          {/* Search + filters */}
          <div className="mb-5 space-y-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search by title or department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-sm border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Mode</span>
                <div className="flex gap-1">
                  {WORK_MODE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setWorkMode(f.value)}
                      className={`cursor-pointer rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                        workMode === f.value
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Type</span>
                <div className="flex gap-1">
                  {JOB_TYPE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setJobType(f.value)}
                      className={`cursor-pointer rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                        jobType === f.value
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {(search || workMode || jobType) && (
                <button
                  onClick={() => { setSearch(""); setWorkMode(""); setJobType(""); }}
                  className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600"
                >
                  Clear ×
                </button>
              )}
            </div>

            {(search || workMode || jobType) && (
              <p className="text-[10px] font-semibold text-slate-400">
                {filtered.length} of {jobs.length} positions
              </p>
            )}
          </div>

          {/* Cards */}
          {filtered.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-200 py-20 text-center">
              <p className="text-sm font-semibold text-slate-500">
                {jobs.length === 0 ? "No open positions right now" : "No positions match your filters"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {jobs.length === 0 ? "Check back later for new opportunities" : "Try adjusting your search or filters"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((job) => {
                const date = job.posted_at?.toDate?.() ?? null;
                const isNew = !!date && Date.now() - date.getTime() < 3 * 86_400_000;
                const visibleSkills = job.required_skills.slice(0, 4);
                const extraSkills = job.required_skills.length - visibleSkills.length;
                return (
                  <div
                    key={job.job_id}
                    className="group relative flex flex-col overflow-hidden rounded-sm border border-slate-200 bg-white transition-all hover:border-blue-200 hover:shadow-md hover:shadow-blue-50/60"
                  >
                    {/* Left accent line */}
                    <div className="absolute inset-y-0 left-0 w-0.5 bg-blue-600 opacity-0 transition-opacity group-hover:opacity-100" />

                    {/* Card body */}
                    <div className="flex flex-col gap-3 p-5">

                      {/* Header */}
                      <div className="flex items-start gap-3">
                        {/* Company avatar */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-[14px] font-black text-white ${avatarBg(job.company_name)}`}>
                          {job.company_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {job.company_name}
                            </p>
                            {isNew && (
                              <span className="shrink-0 rounded-sm bg-blue-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">
                                New
                              </span>
                            )}
                          </div>
                          <h2
                            className="mt-0.5 text-[15px] font-black leading-snug text-slate-900 transition-colors group-hover:text-blue-600"
                            style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
                          >
                            {job.job_title}
                          </h2>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {job.location && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                            </svg>
                            {job.location}
                          </span>
                        )}
                        {job.work_mode && (
                          <span className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold ${
                            job.work_mode === "Remote"  ? "bg-green-50 text-green-700" :
                            job.work_mode === "Hybrid"  ? "bg-purple-50 text-purple-700" :
                                                          "bg-orange-50 text-orange-700"
                          }`}>
                            {job.work_mode}
                          </span>
                        )}
                        {job.job_type && (
                          <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{job.job_type}</span>
                        )}
                        {job.openings > 0 && (
                          <span className="text-[10px] font-medium text-slate-400">{job.openings} opening{job.openings !== 1 ? "s" : ""}</span>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-slate-100" />

                      {/* Description */}
                      {job.job_description && (
                        <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                          {job.job_description}
                        </p>
                      )}

                      {/* Skills */}
                      {visibleSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {visibleSkills.map((s) => (
                            <span key={s} className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {s}
                            </span>
                          ))}
                          {extraSkills > 0 && (
                            <span className="rounded-sm border border-dashed border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                              +{extraSkills} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card footer */}
                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                      <div className="flex items-center gap-2">
                        {job.experience_level && (
                          <span className="rounded-sm bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{job.experience_level}</span>
                        )}
                        {date && (
                          <span className="text-[10px] text-slate-400">· {daysAgo(date)}</span>
                        )}
                      </div>
                      {appliedJobIds.has(job.job_id) ? (
                        <span className="shrink-0 rounded-sm bg-slate-100 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-not-allowed">
                          Applied
                        </span>
                      ) : (
                        <button
                          onClick={() => router.push(`/candidate/apply?job_id=${job.job_id}`)}
                          className="cursor-pointer shrink-0 rounded-sm bg-blue-600 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
                        >
                          Apply →
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
