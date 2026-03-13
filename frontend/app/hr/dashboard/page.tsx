"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import HRSidebar from "@/components/HRSidebar";

type StatusCounts = { 
  processing: number; 
  pending: number; 
  approved: number; 
  rejected: number; 
  total: number 
};

function useRole() {
  return useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem("hireiq-role"),
    () => null
  );
}

interface JobDoc {
  job_id: string;
  job_title: string;
  department: string;
  experience_level: string;
  job_type: string;
  work_mode: string;
  posted_at: Timestamp | null;
  posted_date: Date | null;
  processing: number;
  pending: number;
  approved: number;
  rejected: number;
  total_applicants: number;
}

function normalizeJobId(value: unknown) {
  if (!value) return "";
  return String(value).trim();
}

// Fixed date formatting function
function formatDate(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return "—";
  
  try {
    if (timestamp && typeof timestamp.toDate === 'function') {
      const date = timestamp.toDate();
      return date.toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      });
    }
    
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      });
    }
    
    return "—";
  } catch (error) {
    console.error("Error formatting date:", error);
    return "—";
  }
}

// Fixed DonutChart component
function DonutChart({ processing, approved, pending, rejected }: { processing: number; approved: number; pending: number; rejected: number }) {
  const proc = Number(processing) || 0;
  const app = Number(approved) || 0;
  const pend = Number(pending) || 0;
  const rej = Number(rejected) || 0;
  
  const total = proc + app + pend + rej;
  
  if (total === 0) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-slate-100 text-[10px] text-slate-400">
        No data
      </div>
    );
  }

  const processingPct = (proc / total) * 100;
  const approvedPct = (app / total) * 100;
  const pendingPct = (pend / total) * 100;
  const rejectedPct = (rej / total) * 100;

  const gradientStyle = {
    background: `conic-gradient(
      #3b82f6 0% ${processingPct}%,
      #22c55e ${processingPct}% ${processingPct + approvedPct}%,
      #eab308 ${processingPct + approvedPct}% ${processingPct + approvedPct + pendingPct}%,
      #ef4444 ${processingPct + approvedPct + pendingPct}% 100%
    )`,
  };

  return (
    <div className="relative">
      <div 
        className="h-28 w-28 rounded-full"
        style={gradientStyle}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white">
          <div className="text-center">
            <span className="text-[18px] font-black text-slate-900" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
              {total}
            </span>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Total
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineBar({ processing, approved, pending, rejected }: { processing: number; approved: number; pending: number; rejected: number }) {
  const proc = Number(processing) || 0;
  const app = Number(approved) || 0;
  const pend = Number(pending) || 0;
  const rej = Number(rejected) || 0;
  
  const total = proc + app + pend + rej;
  
  if (total === 0) {
    return <div className="h-2 w-full rounded-full bg-slate-100" />;
  }
  
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {proc > 0 && (
        <div 
          style={{ width: `${(proc / total) * 100}%` }} 
          className="bg-blue-500 transition-all duration-300"
          title={`Processing: ${proc}`}
        />
      )}
      {app > 0 && (
        <div 
          style={{ width: `${(app / total) * 100}%` }} 
          className="bg-green-500 transition-all duration-300"
          title={`Approved: ${app}`}
        />
      )}
      {pend > 0 && (
        <div 
          style={{ width: `${(pend / total) * 100}%` }} 
          className="bg-yellow-500 transition-all duration-300"
          title={`Pending: ${pend}`}
        />
      )}
      {rej > 0 && (
        <div 
          style={{ width: `${(rej / total) * 100}%` }} 
          className="bg-red-500 transition-all duration-300"
          title={`Rejected: ${rej}`}
        />
      )}
    </div>
  );
}

function ApplicantsBarChart({ jobs }: { jobs: JobDoc[] }) {
  if (jobs.length === 0) {
    return <div className="flex h-32 items-center justify-center text-xs text-slate-400">No jobs available</div>;
  }

  // Get jobs with applicants, filter out jobs with 0 applicants for better visualization
  const jobsWithApplicants = jobs.filter(job => job.total_applicants > 0);
  
  // If no jobs have applicants, show message
  if (jobsWithApplicants.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-slate-400">
        No applicants yet
      </div>
    );
  }

  const max = Math.max(...jobsWithApplicants.map((j) => j.total_applicants), 1);
  
  // Take top 8 jobs with applicants
  const topJobs = [...jobsWithApplicants]
    .sort((a, b) => b.total_applicants - a.total_applicants)
    .slice(0, 8);
  
  return (
    <div className="flex h-32 items-end gap-2">
      {topJobs.map((job) => {
        // Calculate height percentage based on max value
        const pct = (job.total_applicants / max) * 100;
        // Set minimum height to 8px for 1 applicant, but scale properly
        const height = job.total_applicants === 1 
          ? Math.max(8, pct) // For 1 applicant, show at least 8px
          : Math.max(pct, 4); // For others, minimum 4px
        
        return (
          <div key={job.job_id} className="group relative flex flex-1 flex-col items-center gap-1">
            <div className="relative w-full h-full flex flex-col justify-end">
              {/* Bar with tooltip */}
              <div 
                className="w-full rounded-sm bg-blue-600 transition-all duration-300 hover:bg-blue-700"
                style={{ 
                  height: `${height}%`, 
                  minHeight: job.total_applicants > 0 ? '4px' : '0px'
                }}
              />
              {/* Value label for small numbers */}
              {job.total_applicants <= 2 && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-blue-600">
                  {job.total_applicants}
                </div>
              )}
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 z-10">
                {job.job_title}: {job.total_applicants} applicant{job.total_applicants !== 1 ? 's' : ''}
              </div>
            </div>
            <span className="max-w-full truncate text-[8px] font-bold uppercase tracking-wide text-slate-400">
              {job.job_title.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function HRDashboard() {
  const router = useRouter();
  const role = useRole();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobDoc[]>([]);

  useEffect(() => {
    if (role !== "hr") return;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        console.log("Fetching jobs and candidates...");

        // Fetch jobs and candidates
        const [jobsSnap, candidatesSnap] = await Promise.all([
          getDocs(query(collection(db, "jobs"), orderBy("posted_at", "desc"))),
          getDocs(collection(db, "candidates"))
        ]);

        console.log(`Found ${jobsSnap.size} jobs and ${candidatesSnap.size} candidates`);

        // IMPORTANT: Only count candidates, don't use total_applicants from jobs
        const counts: Record<string, StatusCounts> = {};

        // Process candidates to get accurate counts per job
        candidatesSnap.docs.forEach((doc) => {
          const data = doc.data();
          const jobId = normalizeJobId(data.job_id);
          
          if (!jobId) {
            console.log("Candidate missing job_id:", doc.id);
            return;
          }
          
          if (!counts[jobId]) {
            counts[jobId] = { 
              processing: 0, 
              pending: 0, 
              approved: 0, 
              rejected: 0, 
              total: 0 
            };
          }
          
          // Increment total for this job
          counts[jobId].total += 1;
          
          // Count by status
          const status = (data.status || "").toUpperCase();
          switch (status) {
            case "PROCESSING":
            case "IN_PROGRESS":
            case "REVIEWING":
              counts[jobId].processing += 1;
              break;
            case "PENDING":
            case "PENDING REVIEW":
              counts[jobId].pending += 1;
              break;
            case "APPROVED":
            case "ACCEPTED":
            case "HIRED":
              counts[jobId].approved += 1;
              break;
            case "REJECTED":
            case "DECLINED":
              counts[jobId].rejected += 1;
              break;
            default:
              console.warn(`Unknown status: ${status} for candidate ${doc.id}`);
              // Count unknown statuses as pending by default
              counts[jobId].pending += 1;
          }
        });

        console.log("Final counts from candidates:", counts);

        // Process jobs using ONLY the counts from candidates
        const processedJobs = jobsSnap.docs.map((doc) => {
          const data = doc.data();
          const jobId = normalizeJobId(data.job_id || doc.id);
          
          // Get counts from candidates data (NOT from job document)
          const jobCounts = counts[jobId] || { 
            processing: 0, 
            pending: 0, 
            approved: 0, 
            rejected: 0, 
            total: 0 
          };

          console.log(`Job ${jobId} (${data.job_title}) has ${jobCounts.total} candidates`);

          return {
            job_id: jobId,
            job_title: data.job_title || "Untitled Position",
            department: data.department || "Unspecified",
            experience_level: data.experience_level || "Not specified",
            job_type: data.job_type || "Full-time",
            work_mode: data.work_mode || "On-site",
            posted_at: data.posted_at || null,
            posted_date: data.posted_at?.toDate?.() || null,
            // Use ONLY the counts from candidates, ignore total_applicants field
            processing: jobCounts.processing,
            pending: jobCounts.pending,
            approved: jobCounts.approved,
            rejected: jobCounts.rejected,
            total_applicants: jobCounts.total, // This is the accurate count from candidates
          };
        });

        console.log("Processed jobs with accurate counts:", processedJobs);
        setJobs(processedJobs);
      } catch (err) {
        console.error("Error loading dashboard:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [role]);

  // Redirect if not HR
  useEffect(() => {
    if (role !== "hr") {
      router.replace("/");
    }
  }, [role, router]);

  if (role !== "hr") {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen">
        <HRSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen">
        <HRSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-sm bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate totals from jobs array (which now has accurate counts)
  const totalJobs = jobs.length;
  const totalApplicants = jobs.reduce((sum, job) => sum + job.total_applicants, 0);
  const totalProcessing = jobs.reduce((sum, job) => sum + job.processing, 0);
  const totalApproved = jobs.reduce((sum, job) => sum + job.approved, 0);
  const totalPending = jobs.reduce((sum, job) => sum + job.pending, 0);
  const totalRejected = jobs.reduce((sum, job) => sum + job.rejected, 0);
  const approvalRate = totalApplicants > 0 
    ? Math.round((totalApproved / totalApplicants) * 100) 
    : 0;

  console.log("Dashboard totals:", {
    totalJobs,
    totalApplicants,
    totalProcessing,
    totalApproved,
    totalPending,
    totalRejected
  });

  return (
    <div className="flex min-h-screen">
      <HRSidebar />
      <div className="ml-56 min-h-screen flex-1 bg-white">
        {/* Header */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div>
                <h1 className="text-[18px] font-black uppercase leading-none tracking-widest text-blue-600" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                  Dashboard
                </h1>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Hiring overview
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/hr")}
              className="flex cursor-pointer items-center gap-2 rounded-sm bg-blue-600 px-4 py-2 text-[12px] font-bold uppercase tracking-widest text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Post Job
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-7">
            {[
              { label: "Total Jobs", value: totalJobs, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
              { label: "Applicants", value: totalApplicants, color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" },
              { label: "Processing", value: totalProcessing, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-100" },
              { label: "Pending", value: totalPending, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-100" },
              { label: "Approved", value: totalApproved, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
              { label: "Rejected", value: totalRejected, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
              { label: "Approval Rate", value: `${approvalRate}%`, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-sm border ${stat.border} ${stat.bg} px-4 py-3`}>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                <p className={`mt-1 text-2xl font-black leading-none ${stat.color}`} style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          {totalJobs > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Bar Chart */}
              <div className="col-span-2 rounded-sm border border-slate-200 bg-white p-5">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Applicants per Job
                </p>
                <div className="mb-4 flex items-center gap-1.5">
                  <div className="h-0.5 w-6 rounded-full bg-blue-600" />
                  <div className="h-0.5 w-2 rounded-full bg-blue-300" />
                </div>
                <ApplicantsBarChart jobs={jobs} />
              </div>

              {/* Donut Chart */}
              <div className="rounded-sm border border-slate-200 bg-white p-5">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Pipeline Overview
                </p>
                <div className="mb-4 flex items-center gap-1.5">
                  <div className="h-0.5 w-6 rounded-full bg-blue-600" />
                  <div className="h-0.5 w-2 rounded-full bg-blue-300" />
                </div>
                <div className="flex items-center gap-4">
                  <DonutChart 
                    processing={totalProcessing} 
                    approved={totalApproved} 
                    pending={totalPending} 
                    rejected={totalRejected} 
                  />
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                      <span className="text-slate-600">Processing</span>
                      <span className="ml-auto font-black text-slate-900">{totalProcessing}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                      <span className="text-slate-600">Approved</span>
                      <span className="ml-auto font-black text-slate-900">{totalApproved}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-500" />
                      <span className="text-slate-600">Pending</span>
                      <span className="ml-auto font-black text-slate-900">{totalPending}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                      <span className="text-slate-600">Rejected</span>
                      <span className="ml-auto font-black text-slate-900">{totalRejected}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="h-px bg-slate-100" />

          {/* Job Listings */}
          <div>
            <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
              All Job Listings
            </p>

            {jobs.length === 0 ? (
              <div className="rounded-sm border border-dashed border-slate-200 py-16 text-center">
                <p className="mb-1 text-sm font-semibold text-slate-500">No jobs posted yet</p>
                <p className="text-xs text-slate-400">Click "Post Job" to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div 
                    key={job.job_id} 
                    className="rounded-sm border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm hover:shadow-blue-50"
                  >
                    {/* Job Header */}
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2.5">
                          <h2 className="text-[16px] font-black text-slate-900 leading-tight" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                            {job.job_title}
                          </h2>
                          <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-slate-400">
                            {job.job_id}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {job.department && <Tag>{job.department}</Tag>}
                          {job.experience_level && <Tag blue>{job.experience_level}</Tag>}
                          {job.job_type && <Tag>{job.job_type}</Tag>}
                          {job.work_mode && <Tag>{job.work_mode}</Tag>}
                          <span className="text-[10px] text-slate-400">
                            · Posted {formatDate(job.posted_at)}
                          </span>
                        </div>
                      </div>

                      {/* Job Actions */}
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-[18px] font-black leading-none text-slate-900" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                            {job.total_applicants}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                            Applicants
                          </p>
                        </div>
                        <button
                          onClick={() => router.push(`/hr/candidates?job_id=${encodeURIComponent(job.job_id)}`)}
                          className="cursor-pointer rounded-sm border border-blue-200 bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 transition-all hover:bg-blue-50 active:scale-95"
                        >
                          View →
                        </button>
                      </div>
                    </div>

                    {/* Pipeline Bar */}
                    <div className="space-y-1.5">
                      <PipelineBar 
                        processing={job.processing} 
                        approved={job.approved} 
                        pending={job.pending} 
                        rejected={job.rejected} 
                      />
                      <div className="flex flex-wrap items-center gap-4 text-[10px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {job.processing} processing
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          {job.approved} approved
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                          {job.pending} pending
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          {job.rejected} rejected
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tag({ children, blue }: { children: React.ReactNode; blue?: boolean }) {
  return (
    <span className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold ${
      blue ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"
    }`}>
      {children}
    </span>
  );
}