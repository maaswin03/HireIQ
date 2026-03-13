**Inspiration**

Every day, recruiters spend hours doing something AI should handle - reading the 
same resume format, Googling candidate GitHub profiles, manually checking LeetCode 
scores. Meanwhile, great candidates wait days for a response that never comes.

We asked one question: **What if the entire screening process took 5 minutes instead of 5 days?**

That question became HireIQ.

---

**What It Does**

HireIQ is a full-stack AI hiring platform that deploys **9 specialized agents** to 
evaluate every candidate signal - resume, code, problem-solving, and certifications - then puts the final decision exactly where it belongs: **in human hands**.

Here's what happens the moment a candidate hits Submit:

---

**Phase 1 - Data Fetching**
> Before any AI runs, HireIQ automatically fetches raw data from every source 
> the candidate provided - no manual lookup, no copy-pasting.

- **Resume** - parsed in-browser via PDF.js, converted to plain text
- **GitHub** - REST API pulls repos, top languages, stars, activity, coding history
- **LeetCode** - GraphQL API returns solve counts, contest rating, global rank, badges
- **Credly** - scraper fetches issuer-verified badge names and issuers

> All fetched data is assembled into **one unified candidate JSON** and sent to 
> the Airia pipeline for AI evaluation.

---

**Phase 2 - 7 Agent AI Pipeline (powered by Airia)**
> The candidate JSON passes through 7 specialist agents in sequence. 
> Each agent reads the full JSON, fills only its designated fields, 
> and passes the enriched JSON to the next agent.

| Agent | What It Does |
|---|---|
| **Planner** | First agent to receive the JSON - validates structure, ensures all fields are clean and ready for downstream agents |
| **Screener** | Reads `resume_text` vs `job_description` - scores skill match, finds gaps, detects red flags in the resume |
| **GitHub Agent** | Reads `github_data` - evaluates language relevance to the JD, repo depth, activity recency, and coding history |
| **LeetCode Agent** | Reads `leetcode_data` - scores DSA proficiency, validates contest rating against resume claims, checks consistency badges |
| **Credly Agent** | Reads `credly_data` + `resume_text` - cross-checks Credly badges against resume cert claims, scores certification relevance |
| **Analyzer** | Reads all 4 analysis blocks - calculates weighted overall score, builds combined strengths, weaknesses, and red flags |
| **Decision** | Reads final scores and red flags - issues APPROVE or REJECT with a confidence level and detailed HR-facing reasoning |

> By the end of Phase 2, the candidate JSON contains scores, strengths, weaknesses, 
> red flags, a weighted overall score, and a hiring recommendation - all generated 
> automatically without any human input.

---

**Phase 3 - Human in the Loop**
> HR opens a complete 360° analysis - scores, strengths, weaknesses, red flags, 
> and AI reasoning. One click. Approve or Reject.
> The AI recommends. The human decides.

---

**Phase 4 - Automated Communications (2 more agents)**
> HR's decision triggers one final Airia agent. It reads the candidate JSON 
> and generates a fully personalized email and Slack notification - 
> never generic, never templated.

| Agent | Triggered When | What It Does |
|---|---|---|
| **Selection Agent** | HR clicks Approve | Reads `combined_strengths` + `oa_link` - writes a warm personalized approval email mentioning specific things that impressed the team, includes the online assessment link |
| **Rejection Agent** | HR clicks Reject | Reads `combined_weaknesses` + `combined_strengths` - writes a kind rejection email with one genuine compliment and constructive career advice, never mentions scores or AI |

> Both agents sign off using the **company name** - not HireIQ.
> Candidate email sent via **Resend**. HR channel pinged via **Slack webhook** instantly.

---

**How We Built It**

HireIQ is built on a modern full-stack architecture designed for speed, 
reliability, and seamless AI orchestration across every layer.

---

**Frontend — Next.js + TypeScript + Tailwind CSS**
Two completely separate portals built in one codebase — an HR dashboard 
for managing jobs, reviewing candidates, and making decisions, and a 
candidate-facing application flow that feels like a clean, modern job portal.
Deployed on **Vercel** for instant global availability.

---

**AI Orchestration - Airia**
The brain of HireIQ. Three independent Airia pipelines coordinate all 9 agents:
- **Analysis Pipeline** - 7 agents run in sequence, each enriching the same 
  candidate JSON before passing it forward
- **Selection Pipeline** - single agent triggered on HR approval
- **Rejection Pipeline** - single agent triggered on HR rejection

We deliberately chose **4 different AI models** matched to each agent's job:
- **Gemini 1.5 Flash** → Planner, GitHub, LeetCode, Credly - speed-optimized 
  for structured data extraction
- **Gemini 2.5 Pro** → Analyzer, Decision - deep reasoning for synthesis and judgment
- **Claude Sonnet 4.6** → Screener - best in class for resume comprehension and nuance
- **GPT-4.1** → Selection, Rejection - natural, human-sounding communication

---

**Data Fetching - 4 Live APIs**
Every data point is fetched live at the moment of application - nothing is 
self-reported, nothing is taken at face value:
- **GitHub REST API** - real repository data, language breakdown, activity history
- **LeetCode GraphQL API** - verified solve counts, contest rating, global ranking
- **Credly Scraper** - issuer-verified badges that cannot be faked
- **PDF.js** - resume parsed entirely in the browser, no file upload needed

---

**Database - Firebase**
A real-time NoSQL backend that tracks every candidate through every stage 
of the pipeline - from the moment they apply to the moment they receive 
their email. Status updates happen live, ensuring HR always sees the 
most current state of every application.

---

**Communications - Resend + Slack**
- **Resend** delivers personalized candidate emails via a verified custom domain
- **Slack Incoming Webhook** pings the HR channel the moment a decision is made

Every email is generated fresh by an AI agent - referencing the candidate's 
actual projects, using the company name, reading like a real human wrote it.

---

**The Hard Problems We Solved**

**Agents Were Lying**

Early runs had agents inventing fields, wrapping output in markdown, and silently 
dropping data. We engineered strict JSON contracts - every agent knows exactly 
what to touch, what to leave alone, and that the response must start with `{` 
and end with `}`. Nine agents. Zero data loss.

**AI Was Too Harsh**

The pipeline flagged completely normal things as red flags - different emails on 
resume vs application, missing Credly certs for Udemy holders, LeetCode current 
vs peak rating gaps. We built explicit validation rules into every agent. 
Real hiring nuance, engineered into every prompt.

**Making AI Sound Human**

The candidate never knows AI evaluated them. Every email reads like a real recruiter 
wrote it - referencing their actual projects, using the company name, signing off 
as the company hiring team. Prompt engineering for tone is harder than prompt 
engineering for logic.

---

**What We Learned**

> The best AI systems aren't the ones that do the most - they're the ones that 
> know exactly when to hand control back to a human.

- Choosing the right model for each task matters more than using one powerful model for everything
- Real candidate data breaks assumptions that synthetic data never would
- In hiring, how you say no matters as much as the decision itself

---

**What's Next**

- **Faster pipeline** - parallel agent execution to cut 5 minutes down to under 90 seconds
- **Interview scheduling** - one click calendar invite directly from the HR dashboard
- **Bias detection** - flag if decisions correlate with non-merit signals
- **ATS integration** - plug HireIQ into Greenhouse, Lever, or Workday