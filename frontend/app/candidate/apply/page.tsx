"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCandidateId } from "@/lib/auth";

/* ── Client-side PDF text extraction ── */
async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items
        .filter((item): item is Extract<typeof item, { str: string }> => "str" in item)
        .map((item) => item.str)
        .join(" ") + "\n";
    }
    return text.trim();
  } catch {
    return "";
  }
}
import CandidateSidebar from "@/components/CandidateSidebar";

interface JobData {
  job_id: string;
  job_title: string;
  company_name: string;
  company_about: string;
  job_description: string;
  oa_link: string;
  department: string;
  experience_level: string;
  job_type: string;
  work_mode: string;
  location: string;
  required_skills: string[];
  openings: number;
  deadline: string;
}

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  years_of_experience: string;
  github_username: string;
  leetcode_username: string;
  credly_url: string;
  cover_note: string;
}

const defaultForm: FormState = {
  full_name: "",
  email: "",
  phone: "",
  years_of_experience: "",
  github_username: "",
  leetcode_username: "",
  credly_url: "",
  cover_note: "",
};

function generateAppId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `APP-${year}-${rand}`;
}

/* ── Company avatar colour ── */
const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500",
  "bg-rose-500",  "bg-amber-500",  "bg-teal-500",
];
function avatarBg(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

/* ── Input styling ── */
const inputClass =
  "w-full rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50";

/* ══════════════════════════════════════════════
   Apply Form
   ══════════════════════════════════════════════ */
function ApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id") || "";

  const [job, setJob] = useState<JobData | null>(null);
  const [pageLoading, setPageLoading] = useState(!!jobId);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [error, setError] = useState<string | null>(jobId ? null : "No job ID provided");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Role guard — Suspense makes this component client-only so localStorage is always available
  useEffect(() => {
    if (localStorage.getItem("hireiq-role") !== "candidate") {
      router.replace("/");
    }
  }, [router]);

  // Load job from Firestore
  useEffect(() => {
    if (!jobId) return;
    getDoc(doc(db, "jobs", jobId))
      .then((snap) => {
        if (snap.exists()) setJob(snap.data() as JobData);
        else setError("Job not found");
      })
      .catch(() => setError("Failed to load job"))
      .finally(() => setPageLoading(false));
  }, [jobId]);

  // Check if this candidate already applied to this job
  useEffect(() => {
    if (!jobId) return;
    const userId = localStorage.getItem("hireiq-candidate-id");
    if (!userId) return;
    getDocs(query(collection(db, "candidates"), where("user_id", "==", userId)))
      .then((snap) => {
        if (snap.docs.some((d) => d.data().job_id === jobId)) {
          setAlreadyApplied(true);
        }
      })
      .catch(() => {});
  }, [jobId]);

  // Autosave to localStorage on every change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },
    []
  );

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    setSubmitting(true);
    setError(null);

    try {
      const applicationId = generateAppId();
      // Ensure there's always a stable candidate ID — generate one if the user
      // arrived without going through role-selection.
      let userId = getCandidateId();
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem("hireiq-candidate-id", userId);
      }

      // Guard against duplicate applications
      const existingSnap = await getDocs(
        query(collection(db, "candidates"), where("user_id", "==", userId))
      );
      if (existingSnap.docs.some((d) => d.data().job_id === jobId)) {
        setAlreadyApplied(true);
        setSubmitting(false);
        return;
      }

      // Extract PDF text in the browser — no Storage upload needed
      const resumeText = resumeFile ? await extractPdfText(resumeFile) : "";

      // Save candidates doc with resume_text already included
      await setDoc(doc(db, "candidates", applicationId), {
        application_id: applicationId,
        user_id: userId,
        job_id: jobId,
        company_name: job.company_name || "",
        company_description: job.company_about || "",
        candidate_name: form.full_name,
        email: form.email,
        phone: form.phone,
        years_of_experience: Number(form.years_of_experience) || 0,
        github_username: form.github_username,
        leetcode_username: form.leetcode_username,
        credly_url: form.credly_url,
        cover_note: form.cover_note,
        resume_text: resumeText,
        status: "PROCESSING",
        applied_at: serverTimestamp(),
      });

      // Increment total_applicants on the job
      await updateDoc(doc(db, "jobs", jobId), {
        total_applicants: increment(1),
      });

      // Redirect immediately — user is done
      router.push(
        `/candidate/thankyou?application_id=${encodeURIComponent(applicationId)}&name=${encodeURIComponent(form.full_name)}&email=${encodeURIComponent(form.email)}`
      );

      // Trigger server pipeline (fire-and-forget)
      fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId, job_id: jobId, user_id: userId }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  /* ── Loading state ── */
  if (pageLoading) {
    return (
      <div className="flex min-h-screen">
        <CandidateSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading job details...</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error / no job ── */
  if (error && !job) {
    return (
      <div className="flex min-h-screen">
        <CandidateSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <p className="mb-4 text-sm text-red-500">{error}</p>
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

  /* ── Submitting state ── */
  if (submitting) {
    return (
      <div className="flex min-h-screen">
        <CandidateSidebar />
        <div className="ml-56 flex flex-1 items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600" />
            <p className="text-sm font-medium text-slate-700">Submitting your application...</p>
            <p className="mt-1 text-xs text-slate-500">
              Uploading your resume, please wait...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="flex h-screen overflow-hidden">
      <CandidateSidebar />
      <div className="ml-56 flex h-screen flex-1 flex-col overflow-hidden">

        {/* Page header */}
        <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div>
                <h1 className="text-[18px] font-black uppercase leading-none tracking-widest text-blue-600" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                  Apply Now
                </h1>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{job!.job_title}</p>
              </div>
            </div>
            <button onClick={() => router.back()} className="cursor-pointer rounded-sm border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 active:scale-95">
              ← Back
            </button>
          </div>
        </div>

        {/* Split body */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT: Job Details ── */}
          <div className="w-1/2 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">

            {/* Hero band */}
            <div className="bg-linear-to-br from-blue-600 to-blue-700 px-6 py-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm text-[18px] font-black text-white shadow-md shadow-blue-800/30 ${avatarBg(job!.company_name)}`}>
                  {job!.company_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-widest text-blue-200">
                    {job!.company_name}
                  </p>
                  <h2 className="mt-0.5 text-[20px] font-black leading-snug text-white" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                    {job!.job_title}
                  </h2>
                </div>
              </div>

              {/* Meta chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {job!.work_mode && (
                  <span className="rounded-sm bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">{job!.work_mode}</span>
                )}
                {job!.job_type && (
                  <span className="rounded-sm bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white">{job!.job_type}</span>
                )}
                {job!.experience_level && (
                  <span className="rounded-sm bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white">{job!.experience_level}</span>
                )}
                {job!.department && (
                  <span className="rounded-sm bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white">{job!.department}</span>
                )}
              </div>

              {/* Quick facts row */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {job!.location && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-100">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    {job!.location}
                  </span>
                )}
                {job!.openings > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-100">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    </svg>
                    {job!.openings} opening{job!.openings !== 1 ? "s" : ""}
                  </span>
                )}
                {job!.deadline && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-100">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Deadline: {job!.deadline}
                  </span>
                )}
              </div>
            </div>

            {/* Body sections */}
            <div className="space-y-0 divide-y divide-slate-100">

              {/* About the role */}
              {job!.job_description && (
                <div className="px-6 py-5">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">About the Role</p>
                  <p className="text-[12px] leading-relaxed text-slate-600">{job!.job_description}</p>
                </div>
              )}

              {/* Required skills */}
              {(job!.required_skills || []).length > 0 && (
                <div className="px-6 py-5">
                  <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Required Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(job!.required_skills || []).map((s) => (
                      <span key={s} className="rounded-sm border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* About the company */}
              {job!.company_about && (
                <div className="bg-slate-50/70 px-6 py-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[10px] font-black text-white ${avatarBg(job!.company_name)}`}>
                      {job!.company_name.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">About {job!.company_name}</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-500">{job!.company_about}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Application Form ── */}
          <div className="w-1/2 overflow-y-auto bg-white">
            <div className="px-8 py-6">

              {/* Section header */}
              <div className="mb-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Your Application</p>
                <h3 className="mt-0.5 text-[16px] font-black text-slate-900" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                  Fill in your details
                </h3>
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="h-0.5 w-6 rounded-full bg-blue-600" />
                  <div className="h-0.5 w-2 rounded-full bg-blue-300" />
                  <div className="h-0.5 w-1 rounded-full bg-blue-200" />
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">

                {/* Full Name */}
                <div>
                  <label htmlFor="full_name" className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input id="full_name" name="full_name" type="text" required value={form.full_name} onChange={handleChange} placeholder="John Doe" className={inputClass} />
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="email" className="mb-1 block text-[11px] font-semibold text-slate-700">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} placeholder="john@example.com" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-1 block text-[11px] font-semibold text-slate-700">
                      Phone <span className="text-red-400">*</span>
                    </label>
                    <input id="phone" name="phone" type="tel" required value={form.phone} onChange={handleChange} placeholder="+91 99999 99999" className={inputClass} />
                  </div>
                </div>

                {/* Years of Experience */}
                <div>
                  <label htmlFor="years_of_experience" className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Years of Experience <span className="text-red-400">*</span>
                  </label>
                  <input id="years_of_experience" name="years_of_experience" type="number" required min="0" max="50" value={form.years_of_experience} onChange={handleChange} placeholder="3" className={inputClass} />
                </div>

                {/* Resume PDF */}
                <div>
                  <label htmlFor="resume" className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Resume (PDF) <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="resume" type="file" required accept=".pdf"
                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    className="w-full cursor-pointer rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 file:mr-3 file:cursor-pointer file:rounded-sm file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:text-blue-600 hover:file:bg-blue-100"
                  />
                </div>

                {/* GitHub + LeetCode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="github_username" className="mb-1 block text-[11px] font-semibold text-slate-700">
                      GitHub Username <span className="text-red-400">*</span>
                    </label>
                    <input id="github_username" name="github_username" type="text" required value={form.github_username} onChange={handleChange} placeholder="octocat" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="leetcode_username" className="mb-1 block text-[11px] font-semibold text-slate-700">
                      LeetCode Username <span className="text-red-400">*</span>
                    </label>
                    <input id="leetcode_username" name="leetcode_username" type="text" required value={form.leetcode_username} onChange={handleChange} placeholder="leetcoder123" className={inputClass} />
                  </div>
                </div>

                {/* Credly */}
                <div>
                  <label htmlFor="credly_url" className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Credly Profile URL <span className="text-[10px] font-normal text-slate-400">(optional)</span>
                  </label>
                  <input id="credly_url" name="credly_url" type="url" value={form.credly_url} onChange={handleChange} placeholder="https://www.credly.com/users/johndoe" className={inputClass} />
                </div>

                {/* Cover Note */}
                <div>
                  <label htmlFor="cover_note" className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Cover Note <span className="text-[10px] font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea id="cover_note" name="cover_note" rows={3} value={form.cover_note} onChange={handleChange} placeholder="Tell us why you're a great fit for this role..." className={`${inputClass} resize-none`} />
                </div>

                {/* Submit */}
                <div className="pt-1">
                  {alreadyApplied ? (
                    <div className="w-full rounded-sm bg-slate-100 px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 cursor-not-allowed">
                      Applied
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="w-full cursor-pointer rounded-sm bg-blue-600 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 active:scale-[0.98]"
                    >
                      Submit Application
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page wrapper with Suspense for useSearchParams ── */
export default function ApplyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        </div>
      }
    >
      <ApplyForm />
    </Suspense>
  );
}
