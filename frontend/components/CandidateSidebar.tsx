"use client";

import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { clearAuth } from "@/lib/auth";

const NAV_ITEMS = [
  {
    label: "Browse Jobs",
    href: "/candidate",
    description: "View open positions",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="14" rx="1" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    label: "My Profile",
    href: "/candidate/profile",
    description: "Applications & info",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export default function CandidateSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    clearAuth();
    router.replace("/");
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-slate-200 bg-white">
      {/* ── Logo ── */}
      <div className="border-b border-slate-200 px-4 py-4">
        {/* icon + wordmark row */}
        <div className="flex items-center gap-3">
          {/* icon block */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
          </div>
          {/* text stack */}
          <div className="flex flex-col">
            <span
              className="text-[18px] font-black uppercase leading-none tracking-widest text-blue-600"
              style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
            >
              HIREIQ
            </span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Hiring Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/candidate" &&
              (pathname === "/candidate" ||
                pathname.startsWith("/candidate/apply")));
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-3 text-left transition-all duration-150 ${
                isActive ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-600"
                }`}
              >
                {item.icon}
              </span>

              {/* text */}
              <span className="flex min-w-0 flex-col">
                <span
                  className={`text-[13px] font-semibold leading-tight ${
                    isActive
                      ? "text-blue-700"
                      : "text-slate-700 group-hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </span>
                <span
                  className={`text-[10px] leading-tight ${
                    isActive ? "text-blue-600" : "text-slate-500"
                  }`}
                >
                  {item.description}
                </span>
              </span>

              {/* active dot */}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mx-4 h-px bg-slate-200" />

      <div className="p-3">
        {/* Role card */}
        <div className="mb-2 flex items-center gap-2.5 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-blue-600 text-[10px] font-black tracking-wide text-white">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-[12px] font-bold text-slate-800">
              Candidate
            </span>
            <span className="text-[10px] text-slate-500">
              Job seeker portal
            </span>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600 transition-all hover:bg-red-100 hover:border-red-300 active:scale-95"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
