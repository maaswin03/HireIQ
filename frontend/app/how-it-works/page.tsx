"use client";

import { useState } from "react";
import Link from "next/link";

// ── icons ─────────────────────────────────────────────────────────────────────
const I = {
  briefcase:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="1"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  user:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  fileText:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  github:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>,
  code:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  award:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
  send:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  layers:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  zap:         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  filter:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  checkCircle: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  xCircle:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  mail:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  slack:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>,
  database:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  arrowDown:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  cpu:         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>,
  eye:         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};

// ── shared helpers ────────────────────────────────────────────────────────────
function Arrow({ color = "text-slate-300" }: { color?: string }) {
  return <div className={`flex justify-center py-2 ${color} opacity-50`}>{I.arrowDown}</div>;
}



function Pill({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="mx-auto flex w-fit items-center gap-2.5 rounded-sm border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-slate-600">{I.user}</div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-800">{label}</p>
        <p className="text-[9px] text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1 — Full Pipeline (all agents + rejection + selection)
// ═════════════════════════════════════════════════════════════════════════════
const pipelineSteps = [
  { num: 1, name: "Planner Agent",   sub: "Parse & Structure",         desc: "Parses raw form data into a clean JSON envelope — resume, metadata, and job description combined.",                                    icon: I.fileText },
  { num: 2, name: "Screener Agent",  sub: "Resume × JD Fit",           desc: "Compares resume against job description. Returns skill match score, experience gaps, and red flags.",                                  icon: I.filter   },
  { num: 3, name: "GitHub Agent",    sub: "Repository Analysis",        desc: "Analyzes top languages, repo count, activity recency, and coding history depth against role requirements.",                           icon: I.github   },
  { num: 4, name: "LeetCode Agent",  sub: "DSA Proficiency",            desc: "Evaluates solve counts (Easy/Medium/Hard), contest rating, global rank, badges, and top DSA topic clusters.",                        icon: I.code     },
  { num: 5, name: "Credly Agent",    sub: "Certification Verification", desc: "Checks Credly for issuer-verified badges. Also reads resume for NPTEL, Udemy, and Coursera certifications.",                         icon: I.award    },
  { num: 6, name: "Analyzer Agent",  sub: "360° Candidate Profile",     desc: "Synthesizes all 4 analysis blocks into combined strengths, weaknesses, red flags, and a weighted overall score.",                    icon: I.layers   },
  { num: 7, name: "Decision Agent",  sub: "APPROVE / REJECT",           desc: "Issues final recommendation with confidence level, HR reasoning, and generates personalised email and Slack message drafts.",        icon: I.zap      },
];

function TabPipeline() {
  return (
    <div>
      <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Phase 1 — Evaluation Pipeline</p>
      <Pill label="Candidate Submission" detail="Name · Email · Resume · GitHub · LeetCode · Credly · Job ID" />
      {pipelineSteps.map((s) => (
        <div key={s.num}>
          <Arrow />
          <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-600 text-white shadow-md shadow-blue-200">{s.icon}</div>
                <span className="text-[9px] font-bold text-blue-600">{String(s.num).padStart(2, "0")}</span>
              </div>
              <div className="flex-1 pt-0.5">
                <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                  <p className="text-[15px] font-black uppercase tracking-widest text-slate-900" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>{s.name}</p>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600">{s.sub}</span>
                </div>
                <p className="text-xs text-slate-500">{s.desc}</p>
              </div>
            </div>
          </div>
        </div>
      ))}

      <Arrow />
      <div className="mx-auto max-w-sm rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Pipeline Output — Firestore</p>
        <div className="space-y-2">
          {[
            { label: "overall_score",      val: "87 / 100",   c: "text-blue-600"  },
            { label: "decision",           val: "PENDING_HR", c: "text-yellow-600" },
            { label: "resume_score",       val: "82 / 100",   c: "text-slate-700" },
            { label: "github_score",       val: "90 / 100",   c: "text-slate-700" },
            { label: "leetcode_score",     val: "78 / 100",   c: "text-slate-700" },
            { label: "combined_strengths", val: "[…3 items]", c: "text-slate-500" },
            { label: "combined_red_flags", val: "[…1 item]",  c: "text-red-500"   },
            { label: "hr_decision",        val: "PENDING",    c: "text-slate-400" },
          ].map(({ label, val, c }) => (
            <div key={label} className="flex items-center justify-between gap-4 text-[11px]">
              <span className="font-mono text-slate-400">{label}</span>
              <span className={`font-bold ${c}`}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 py-3 text-slate-400">
        {I.arrowDown}
        <span className="text-[9px] font-bold uppercase tracking-widest">HR reviews in portal</span>
        {I.arrowDown}
      </div>

      <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Phase 2 — Post-Decision Agents</p>
      <div className="grid gap-4 md:grid-cols-2">

        {/* Selection Agent */}
        <div>
          <div className="mb-2 flex justify-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-green-600">HR Approves →</span>
          </div>
          <div className="rounded-sm border border-green-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-green-600 text-white shadow-md shadow-green-200">{I.checkCircle}</div>
                <span className="text-[9px] font-bold text-green-600">08</span>
              </div>
              <div className="flex-1 pt-0.5">
                <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                  <p className="text-[15px] font-black uppercase tracking-widest text-slate-900" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>Selection Agent</p>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-green-600">Approval Flow</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">Writes a warm congratulations email with next-step details and pings the HR Slack channel.</p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">{I.mail}<span className="font-medium text-green-600">Approval email</span><span className="text-slate-400 ml-auto">→ candidate via Resend</span></div>
                  <div className="flex items-center gap-1.5 text-slate-600">{I.slack}<span className="font-medium text-green-600">Slack ping</span><span className="text-slate-400 ml-auto">→ HR channel</span></div>
                  <div className="flex items-center gap-1.5 text-slate-400">{I.database}<span>hr_decision → APPROVED</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rejection Agent */}
        <div>
          <div className="mb-2 flex justify-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-red-500">HR Rejects →</span>
          </div>
          <div className="rounded-sm border border-red-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-red-500 text-white shadow-md shadow-red-200">{I.xCircle}</div>
                <span className="text-[9px] font-bold text-red-500">09</span>
              </div>
              <div className="flex-1 pt-0.5">
                <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                  <p className="text-[15px] font-black uppercase tracking-widest text-slate-900" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>Rejection Agent</p>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-500">Rejection Flow</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">Writes an empathetic rejection referencing the candidate&apos;s actual gaps — never a generic template.</p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">{I.mail}<span className="font-medium text-red-500">Rejection email</span><span className="text-slate-400 ml-auto">→ candidate via Resend</span></div>
                  <div className="flex items-center gap-1.5 text-slate-600">{I.slack}<span className="font-medium text-red-500">Slack ping</span><span className="text-slate-400 ml-auto">→ HR channel</span></div>
                  <div className="flex items-center gap-1.5 text-slate-400">{I.database}<span>hr_decision → REJECTED</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2 — How the Process Works (end-to-end journey)
// ═════════════════════════════════════════════════════════════════════════════
const processSteps = [
  { num: 1,  name: "HR Posts a Job",           sub: "Job Listing",        desc: "Fills in title, description, required skills, and optional OA link. Live in Firestore instantly.",                          icon: I.briefcase },
  { num: 2,  name: "Candidate Applies",         sub: "Application",        desc: "Browses open roles and submits name, email, resume PDF, plus optional GitHub / LeetCode / Credly links.",                  icon: I.user      },
  { num: 3,  name: "Resume Extraction",         sub: "PDF → Text",         desc: "PDF parsed in-browser via pdf.js. Plain text stored in Firestore — no file upload needed.",                               icon: I.fileText  },
  { num: 4,  name: "GitHub Fetch",              sub: "REST API",            desc: "Pulls public repos for top languages, stars, contribution cadence, and account age.",                                     icon: I.github    },
  { num: 5,  name: "LeetCode Fetch",            sub: "GraphQL API",         desc: "Returns solve counts (E/M/H), contest rating, global rank, and top DSA topic clusters.",                                 icon: I.code      },
  { num: 6,  name: "Credly Fetch",              sub: "Badge Scrape",        desc: "Scrapes the public Credly profile for issuer-verified badges. Cannot be self-reported.",                                  icon: I.award     },
  { num: 7,  name: "Airia Analysis Pipeline",   sub: "7 Specialist Agents", desc: "All data assembled into one JSON and streamed through 7 specialist Airia agents — Resume, GitHub, LeetCode, Credly, Analyzer, and Decision.",  icon: I.send      },
  { num: 8,  name: "Result Storage",            sub: "Firestore",           desc: "Scores, strengths, red flags, and email drafts saved. hr_decision set to PENDING.",                                      icon: I.database  },
  { num: 9,  name: "HR Reviews & Decides",      sub: "Human-in-the-Loop",  desc: "HR opens the 360° analysis and clicks Approve or Reject — the only human decision in the entire pipeline.",              icon: I.eye       },
  { num: 10, name: "Airia Communication Agent", sub: "Selection / Rejection", desc: "HR decision triggers a second Airia agent that generates a personalised email and Slack message based on the outcome.", icon: I.send      },
  { num: 11, name: "Automated Communications",  sub: "Email + Slack",       desc: "Resend delivers the personalised email to the candidate inbox. Slack webhook pings the HR channel instantly.",           icon: I.mail      },
];

function TabProcess() {
  return (
    <div>
      <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">End-to-End Hiring Journey</p>
      {processSteps.map((s, idx) => (
        <div key={s.num}>
          {idx > 0 && <Arrow />}
          <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-600 text-white shadow-md shadow-blue-200">{s.icon}</div>
                <span className="text-[9px] font-bold text-blue-600">{String(s.num).padStart(2, "0")}</span>
              </div>
              <div className="flex-1 pt-0.5">
                <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                  <p className="text-[15px] font-black uppercase tracking-widest text-slate-900" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>{s.name}</p>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600">{s.sub}</span>
                </div>
                <p className="text-xs text-slate-500">{s.desc}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Nav config
// ═════════════════════════════════════════════════════════════════════════════
type TabId = "pipeline" | "process";

const TABS: { id: TabId; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: "pipeline", label: "Agent Pipeline", sub: "All 9 agents", icon: I.layers },
  { id: "process",  label: "How It Works",  sub: "End-to-end journey",      icon: I.zap    },
];

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════
export default function HowItWorksPage() {
  const [active, setActive] = useState<TabId>("pipeline");
  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <div className="flex min-h-screen">

      {/* ── Fixed Sidebar ── */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-slate-200 bg-white">

        {/* Logo */}
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[18px] font-black uppercase leading-none tracking-widest text-blue-600" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>HIREIQ</span>
              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Hiring Intelligence</span>
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex-1 px-3 py-4">
          <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Sections</p>
          <div className="space-y-0.5">
            {TABS.map((t) => {
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-3 text-left transition-all duration-150 ${isActive ? "bg-blue-50" : "hover:bg-slate-50"}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm transition-colors ${isActive ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-600"}`}>
                    {t.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={`text-[13px] font-semibold leading-tight ${isActive ? "text-blue-700" : "text-slate-700 group-hover:text-slate-900"}`}>{t.label}</span>
                    <span className={`text-[10px] leading-tight ${isActive ? "text-blue-600" : "text-slate-500"}`}>{t.sub}</span>
                  </span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Divider */}
        <div className="mx-4 h-px bg-slate-200" />

        {/* Bottom */}
        <div className="p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-blue-600 text-[9px] font-black tracking-wide text-white">AI</div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[12px] font-bold text-slate-800">Architecture</span>
              <span className="text-[10px] text-slate-500">System overview</span>
            </div>
          </div>
          <Link href="/" className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:border-slate-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to home
          </Link>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="ml-56 min-h-screen flex-1 bg-white">

        {/* Top bar */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200 text-white">
              {activeTab.icon}
            </div>
            <div>
              <p className="text-[18px] font-black uppercase tracking-widest text-slate-900 leading-tight" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                {activeTab.label}
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{activeTab.sub}</p>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {active === "pipeline" && <TabPipeline />}
          {active === "process"  && <TabProcess />}
        </div>
      </div>

    </div>
  );
}