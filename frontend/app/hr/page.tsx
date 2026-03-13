"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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

function generateJobId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `JOB-${year}-${rand}`;
}

function CustomSelect({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full cursor-pointer items-center justify-between rounded-sm border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-all ${
          open ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span>{current?.label}</span>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-slate-500 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-sm border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(name, opt.value); setOpen(false); }}
              className={`flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-sm transition-colors ${
                value === opt.value
                  ? "bg-blue-50 font-semibold text-blue-600"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{opt.label}</span>
              {value === opt.value && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-600">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HRPostJob() {
  const router = useRouter();
  const role = useRole();

  const [form, setForm] = useState({
    company_name: "",
    company_about: "",
    job_title: "",
    department: "",
    job_description: "",
    required_skills: "",
    experience_level: "Junior",
    job_type: "Full-time",
    work_mode: "On-site",
    location: "",
    deadline: "",
    openings: "1",
    oa_link: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (role !== "hr") {
    router.replace("/");
    return null;
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSelect(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const job_id = generateJobId();
      const skills = form.required_skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Check your Firestore security rules and network connection.")), 10000)
      );

      await Promise.race([
        setDoc(doc(db, "jobs", job_id), {
          job_id,
          hr_id: getHRId() ?? "",
          company_name: form.company_name,
          company_about: form.company_about,
          job_title: form.job_title,
          department: form.department,
          job_description: form.job_description,
          required_skills: skills,
          experience_level: form.experience_level,
          job_type: form.job_type,
          work_mode: form.work_mode,
          location: form.location,
          deadline: form.deadline,
          openings: Number(form.openings),
          oa_link: form.oa_link,
          posted_at: serverTimestamp(),
          total_applicants: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        }),
        timeout,
      ]);

      setToast(job_id);
      setTimeout(() => setToast(null), 4000);
      setForm({
        company_name: "",
        company_about: "",
        job_title: "",
        department: "",
        job_description: "",
        required_skills: "",
        experience_level: "Junior",
        job_type: "Full-time",
        work_mode: "On-site",
        location: "",
        deadline: "",
        openings: "1",
        oa_link: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <HRSidebar />
      <div className="ml-56 min-h-screen flex-1 bg-white">

        {toast && (
          <div className="fixed right-5 top-5 z-50 flex w-72 items-start gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3.5 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="absolute left-0 top-0 h-full w-0.75 rounded-l-sm bg-green-500" />

            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-green-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold uppercase tracking-wide text-slate-800">Job Published</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                ID: <span className="font-bold text-blue-600">{toast}</span>
              </p>
            </div>

            <button
              onClick={() => setToast(null)}
              className="mt-0.5 cursor-pointer rounded-sm p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <h1
                className="text-[18px] font-black uppercase leading-none tracking-widest text-blue-600"
                style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
              >
                Post a Job
              </h1>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Create a new position
              </p>
            </div>
          </div>

        </div>

        <main className="px-6 py-6">

          {error && (
            <div className="mb-6 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600 uppercase tracking-wide">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">

            <div>
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Company
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="company_name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Company Name <span className="text-red-400 normal-case">*</span>
                  </label>
                  <input
                    id="company_name"
                    name="company_name"
                    type="text"
                    required
                    value={form.company_name}
                    onChange={handleChange}
                    placeholder="e.g. Acme Corp"
                    className="w-full rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="company_about" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    About the Company <span className="normal-case text-slate-300">(optional)</span>
                  </label>
                  <textarea
                    id="company_about"
                    name="company_about"
                    rows={3}
                    value={form.company_about}
                    onChange={handleChange}
                    placeholder="Brief description of the company, culture, and mission..."
                    className="w-full resize-none rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            <div>
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Position Details
              </p>
              <div className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="job_title" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Job Title
                    </label>
                    <input
                      id="job_title"
                      name="job_title"
                      type="text"
                      required
                      value={form.job_title}
                      onChange={handleChange}
                      placeholder="e.g. Senior Frontend Engineer"
                      className="w-full rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Job Type
                    </label>
                    <CustomSelect
                      name="job_type"
                      value={form.job_type}
                      onChange={handleSelect}
                      options={[
                        { value: "Full-time",  label: "Full-time" },
                        { value: "Part-time",  label: "Part-time" },
                        { value: "Contract",   label: "Contract" },
                        { value: "Internship", label: "Internship" },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="department" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Department
                    </label>
                    <input
                      id="department"
                      name="department"
                      type="text"
                      required
                      value={form.department}
                      onChange={handleChange}
                      placeholder="e.g. B.Tech / Computer Science"
                      className="w-full rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Experience Level
                    </label>
                    <CustomSelect
                      name="experience_level"
                      value={form.experience_level}
                      onChange={handleSelect}
                      options={[
                        { value: "Junior", label: "Junior (0–2 yrs)" },
                        { value: "Mid",    label: "Mid (2–5 yrs)" },
                        { value: "Senior", label: "Senior (5–8 yrs)" },
                        { value: "Lead",   label: "Lead (8+ yrs)" },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Work Mode
                    </label>
                    <CustomSelect
                      name="work_mode"
                      value={form.work_mode}
                      onChange={handleSelect}
                      options={[
                        { value: "On-site", label: "On-site" },
                        { value: "Remote",  label: "Remote" },
                        { value: "Hybrid",  label: "Hybrid" },
                      ]}
                    />
                  </div>
                  <div>
                    <label htmlFor="openings" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      No. of Openings
                    </label>
                    <input
                      id="openings"
                      name="openings"
                      type="number"
                      min="1"
                      required
                      value={form.openings}
                      onChange={handleChange}
                      className="w-full rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="location" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Location <span className="text-red-400 normal-case">*</span>
                    </label>
                    <input
                      id="location"
                      name="location"
                      type="text"
                      required
                      value={form.location}
                      onChange={handleChange}
                      placeholder="e.g. Bengaluru, India"
                      className="w-full rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="deadline" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Application Deadline <span className="text-red-400 normal-case">*</span>
                    </label>
                    <input
                      id="deadline"
                      name="deadline"
                      type="date"
                      required
                      value={form.deadline}
                      onChange={handleChange}
                      className="w-full cursor-pointer rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

              </div>
            </div>

            <div className="h-px bg-slate-200" />

            <div>
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Role Description
              </p>
              <div>
                <label htmlFor="job_description" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Job Description
                </label>
                <textarea
                  id="job_description"
                  name="job_description"
                  required
                  rows={5}
                  value={form.job_description}
                  onChange={handleChange}
                  placeholder="Describe responsibilities, expectations, and what success looks like in this role..."
                  className="w-full resize-none rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            <div>
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Requirements
              </p>
              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label htmlFor="required_skills" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Required Skills
                  </label>
                  <input
                    id="required_skills"
                    name="required_skills"
                    type="text"
                    required
                    value={form.required_skills}
                    onChange={handleChange}
                    placeholder="React, TypeScript, Node.js, AWS"
                    className="w-full rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1.5 text-[10px] text-slate-500">Separate each skill with a comma</p>
                </div>

                <div>
                  <label htmlFor="oa_link" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    OA Assessment Link <span className="normal-case text-slate-300">(optional)</span>
                  </label>
                  <input
                    id="oa_link"
                    name="oa_link"
                    type="url"
                    value={form.oa_link}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full rounded-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

              </div>
            </div>

            <div className="h-px bg-slate-200" />

            <button
              type="submit"
              disabled={submitting}
              className="w-full cursor-pointer rounded-sm bg-blue-600 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Publishing..." : "Publish Job"}
            </button>

          </form>
          
        </main>
      </div>
    </div>

  );
}
