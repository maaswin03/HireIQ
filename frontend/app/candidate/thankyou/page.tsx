"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearAuth } from "@/lib/auth";
import CandidateSidebar from "@/components/CandidateSidebar";

function ThankYouContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("application_id") || "";
  const candidateName = searchParams.get("candidate_name") || "Candidate";
  const email = searchParams.get("email") || "";
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const role = localStorage.getItem("hireiq-role");
    if (role !== "candidate") {
      router.replace("/");
    }
    // form state cleared on submit already; nothing extra needed
  }, [mounted, router]);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen">
      <CandidateSidebar />
      <div className="ml-56 min-h-screen flex-1 bg-white">

        {/* Page header */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-green-600 shadow-md shadow-green-200">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-[18px] font-black uppercase leading-none tracking-widest text-green-700" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
                Application Submitted
              </h1>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Submitted for review</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-md text-center">

            {/* Check icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sm border border-green-200 bg-green-50">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <h2
              className="mb-1 text-[28px] font-black uppercase tracking-widest text-slate-900"
              style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
            >
              Thank you{candidateName ? `, ${candidateName}` : ""}!
            </h2>

            <p className="mb-6 text-sm text-slate-500">
              Your application has been received and our team is now evaluating your profile.
            </p>

            {/* Application ID */}
            {applicationId && (
              <div className="mx-auto mb-5 rounded-sm border border-slate-200 bg-slate-50 px-6 py-4">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Application ID</p>
                <p
                  className="text-[22px] font-black tracking-wider text-blue-600"
                  style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
                >
                  {applicationId}
                </p>
              </div>
            )}


            {/* Buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push("/candidate/profile")}
                className="cursor-pointer rounded-sm bg-blue-600 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
              >
                View My Profile
              </button>
              <button
                onClick={() => router.push("/candidate")}
                className="cursor-pointer rounded-sm border border-slate-200 bg-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
              >
                Browse Jobs
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  );
}
