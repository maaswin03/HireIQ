"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setRole, getRole } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  // If already logged in, skip the home page and go directly to the correct portal
  useEffect(() => {
    const existing = getRole();
    if (existing === "hr") router.replace("/hr/dashboard");
    else if (existing === "candidate") router.replace("/candidate");
  }, [router]);

  function selectRole(role: "hr" | "candidate") {
    setRole(role);
    router.push(role === "hr" ? "/hr/dashboard" : "/candidate");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white px-6 py-0 md:px-12">
        <div className="flex h-14 items-center justify-between">
          {/* Logo block */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 shadow-md shadow-blue-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="1" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <span className="text-[20px] font-black uppercase tracking-widest text-blue-600" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
              HireIQ
            </span>
          </div>
          {/* Nav actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/how-it-works"
              className="hidden rounded-sm px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 transition-all hover:text-blue-600 sm:inline-flex"
            >
              How it works
            </Link>
            <button
              onClick={() => selectRole("hr")}
              className="cursor-pointer rounded-sm bg-blue-600 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
            >
              I&apos;m HR
            </button>
            <button
              onClick={() => selectRole("candidate")}
              className="cursor-pointer rounded-sm border border-blue-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 transition-all hover:bg-blue-50 active:scale-95"
            >
              I&apos;m a Candidate
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20">
        {/* Scrolling tech keywords */}
        <div className="keyword-fade pointer-events-none absolute inset-0 z-0 hidden overflow-hidden md:flex justify-between px-4 lg:px-10">
          {[
            { cls: "scroll-up",        words: ["Java","Python","React","Node.js","Spring Boot","Django","AWS","Docker","GraphQL","MongoDB","Redis","Go","Rust","Scala","Kafka","C++"] },
            { cls: "scroll-down",      words: ["Angular","Vue.js","Flutter","Swift","Kotlin","Terraform","Jenkins","Firebase","Figma","Ruby","Next.js","Tailwind","Postgres","MySQL","Nginx","Linux"] },
            { cls: "scroll-up-slow",   words: ["TypeScript","Kubernetes","Azure","GCP","Spark","Hadoop","Elastic","Solr","CI/CD","Git","Jira","Agile","REST","gRPC","OAuth","JWT"] },
            { cls: "scroll-down-slow", words: ["ML","TensorFlow","PyTorch","LLM","NLP","OpenAI","Gemini","Claude","RAG","Vector DB","Langchain","Airia","Agents","Prompt","Fine-tune","RLHF"] },
            { cls: "scroll-up",        words: ["Microservices","Serverless","Lambda","S3","CDN","WebSocket","SSE","HTTP/3","WASM","Edge","Vercel","Netlify","Supabase","Prisma","Drizzle","tRPC"] },
            { cls: "scroll-down",      words: ["Selenium","Cypress","Jest","Vitest","Webpack","Vite","ESLint","Prettier","Bash","Zsh","Vim","VS Code","GitHub","GitLab","Bitbucket","npm"] },
            { cls: "scroll-up-slow",   words: ["Express","FastAPI","Flask","Rails","Laravel","Svelte","Remix","Astro","Deno","Bun","pnpm","Turbo","Nx","Storybook","Chromatic","Playwright"] },
          ].map((col, ci) => (
            <div key={ci} className="w-16 overflow-hidden lg:w-20">
              <div className={`${col.cls} flex flex-col items-center gap-5 text-[11px] font-bold uppercase tracking-widest text-blue-300/25`}>
                {[...col.words, ...col.words].map((w, i) => <span key={i}>{w}</span>)}
              </div>
            </div>
          ))}
        </div>

        {/* Center content */}
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          {/* Badge */}
          <div className="animate-fade-in-up mb-5 inline-flex items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Hiring Platform
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-in-up-delay-1 mb-3 text-5xl font-black uppercase leading-tight tracking-tight text-slate-900 md:text-6xl lg:text-7xl"
            style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
          >
            Your Career.{" "}
            <span className="gradient-text">Simplified.</span>
          </h1>

          {/* Accent rule */}
          <div className="animate-fade-in-up-delay-1 mb-5 flex items-center justify-center gap-1.5">
            <div className="h-0.5 w-8 rounded-full bg-blue-600" />
            <div className="h-0.5 w-3 rounded-full bg-blue-300" />
            <div className="h-0.5 w-1.5 rounded-full bg-blue-200" />
          </div>

          {/* Subtitle */}
          <p className="animate-fade-in-up-delay-2 mx-auto mb-10 max-w-lg text-sm leading-relaxed text-slate-500">
            Browse open roles, submit your application, and hear back fast.
            HR teams can post listings and review applicants - all in one place.
          </p>

          {/* CTA */}
          <div className="animate-fade-in-up-delay-3 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => selectRole("hr")}
              className="group inline-flex cursor-pointer items-center gap-2 rounded-sm bg-blue-600 px-6 py-3 text-[12px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
            >
              Get Started as HR
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => selectRole("candidate")}
              className="group inline-flex cursor-pointer items-center gap-2 rounded-sm border border-blue-200 bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-widest text-blue-600 transition-all hover:bg-blue-50 active:scale-95"
            >
              Apply as Candidate
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>



      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 md:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            © 2026 HireIQ · Built with{" "}
            <span className="font-semibold text-blue-600">Airia AI</span>
          </span>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <Link href="/how-it-works" className="hover:text-blue-600 transition-colors">How it works</Link>
            <span className="text-slate-200">·</span>
            <span>For HR Teams</span>
            <span className="text-slate-200">·</span>
            <span>For Candidates</span>
          </div>
        </div>
      </footer>
    </div>
  );
}