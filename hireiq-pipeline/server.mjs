/**
 * HireIQ — Standalone Pipeline Server
 *
 * Completely independent from the Next.js frontend.
 * Receives { application_id, job_id, user_id }, fetches all external data,
 * builds the full structure, calls Airia AI, and writes results to Firestore.
 *
 * Usage:
 *   npm install
 *   cp .env.example .env      ← fill in your values
 *   npm start                 ← production
 *   npm run dev               ← development (auto-restarts on file save)
 *
 * Listens on http://localhost:4000  (override with PIPELINE_PORT env var)
 */

import http from "node:http";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";

// ── Firebase ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(firebaseApp);

// ── GitHub ────────────────────────────────────────────────────────────────────
async function fetchGitHub(username) {
  const empty = {
    username,
    public_repos: 0,
    followers: 0,
    following: 0,
    top_languages: [],
    most_starred_repo: "",
    total_stars: 0,
    total_forks: 0,
    recent_activity: "Unknown",
    coding_since: 0,
    bio: "",
  };
  if (!username) return empty;

  const sanitized = String(username).replace(/[^a-zA-Z0-9_.-]/g, "");
  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${sanitized}`, { headers }),
      fetch(
        `https://api.github.com/users/${sanitized}/repos?per_page=100&sort=stars&direction=desc`,
        { headers }
      ),
    ]);

    if (!userRes.ok || !reposRes.ok) return empty;

    const user = await userRes.json();
    const repos = await reposRes.json();
    if (!Array.isArray(repos)) return empty;

    const langCount = {};
    repos.forEach((r) => {
      if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
    });
    const topLanguages = Object.entries(langCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([l]) => l);

    const topRepo = repos[0];
    const mostStarred = topRepo
      ? `${topRepo.name} (${topRepo.stargazers_count ?? 0} stars)`
      : "";
    const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const totalForks = repos.reduce((s, r) => s + (r.forks_count || 0), 0);

    const sorted = repos
      .filter((r) => r.pushed_at)
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
    const days = sorted.length
      ? Math.floor(
          (Date.now() - new Date(sorted[0].pushed_at).getTime()) / 86_400_000
        )
      : null;

    return {
      username,
      public_repos: user.public_repos || 0,
      followers: user.followers || 0,
      following: user.following || 0,
      top_languages: topLanguages,
      most_starred_repo: mostStarred,
      total_stars: totalStars,
      total_forks: totalForks,
      recent_activity:
        days !== null ? `Active in last ${days} days` : "No recent activity",
      coding_since: user.created_at
        ? new Date(user.created_at).getFullYear()
        : 0,
      bio: user.bio || "",
    };
  } catch (err) {
    console.error("[github] fetch error:", err.message);
    return empty;
  }
}

// ── LeetCode ──────────────────────────────────────────────────────────────────
async function fetchLeetCode(username) {
  const empty = {
    username,
    easy_solved: 0,
    medium_solved: 0,
    hard_solved: 0,
    total_solved: 0,
    contest_rating: 0,
    contest_max_rating: 0,
    contests_attended: 0,
    contest_top_percentage: 0,
    global_ranking: 0,
    badges: [],
    top_languages: [],
    top_dsa_tags: [],
  };
  if (!username) return empty;

  const sanitized = String(username).replace(/[^a-zA-Z0-9_-]/g, "");
  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        Referer: "https://leetcode.com",
        Origin: "https://leetcode.com",
      },
      body: JSON.stringify({
        query: `{
          matchedUser(username: "${sanitized}") {
            submitStats { acSubmissionNum { difficulty count } }
            profile { ranking }
            badges { displayName }
            languageProblemCount { languageName problemsSolved }
            tagProblemCounts {
              advanced { tagName problemsSolved }
              intermediate { tagName problemsSolved }
              fundamental { tagName problemsSolved }
            }
          }
          userContestRanking(username: "${sanitized}") {
            attendedContestsCount
            rating
            globalRanking
            topPercentage
          }
          userContestRankingHistory(username: "${sanitized}") {
            attended
            rating
          }
        }`,
      }),
    });

    const data = await res.json();
    const user = data?.data?.matchedUser;
    if (!user) {
      console.error(
        "[leetcode] matchedUser null for",
        sanitized,
        "— raw:",
        JSON.stringify(data).slice(0, 300)
      );
      return empty;
    }

    const stats = user.submitStats?.acSubmissionNum || [];
    const contest = data?.data?.userContestRanking;
    const history = data?.data?.userContestRankingHistory || [];
    const maxRating = history.filter((h) => h.attended).reduce((max, h) => Math.max(max, h.rating || 0), 0);

    // Top 5 languages by problems solved
    const topLanguages = (user.languageProblemCount || [])
      .sort((a, b) => b.problemsSolved - a.problemsSolved)
      .slice(0, 5)
      .map((l) => l.languageName);

    // Top 5 DSA topics across all difficulty tiers
    const allTags = [
      ...(user.tagProblemCounts?.advanced || []),
      ...(user.tagProblemCounts?.intermediate || []),
      ...(user.tagProblemCounts?.fundamental || []),
    ];
    const topDsaTags = allTags
      .sort((a, b) => b.problemsSolved - a.problemsSolved)
      .slice(0, 5)
      .map((t) => t.tagName);

    return {
      username,
      easy_solved: stats.find((s) => s.difficulty === "Easy")?.count || 0,
      medium_solved: stats.find((s) => s.difficulty === "Medium")?.count || 0,
      hard_solved: stats.find((s) => s.difficulty === "Hard")?.count || 0,
      total_solved: stats.find((s) => s.difficulty === "All")?.count || 0,
      contest_rating: Math.round(contest?.rating || 0),
      contest_max_rating: Math.round(maxRating),
      contests_attended: contest?.attendedContestsCount || 0,
      contest_top_percentage: contest?.topPercentage || 0,
      global_ranking: user.profile?.ranking || 0,
      badges: (user.badges || []).map((b) => b.displayName),
      top_languages: topLanguages,
      top_dsa_tags: topDsaTags,
    };
  } catch (err) {
    console.error("[leetcode] fetch error:", err.message);
    return empty;
  }
}

// ── Credly ────────────────────────────────────────────────────────────────────
async function fetchCredy(url) {
  if (!url) return { certifications: [] };
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("credly.com")) return { certifications: [] };

    const badgesUrl = url.replace(/\/$/, "") + "/badges";
    const res = await fetch(badgesUrl, {
      headers: { Accept: "text/html,application/json" },
    });
    const text = await res.text();

    try {
      const json = JSON.parse(text);
      if (json.data && Array.isArray(json.data)) {
        return {
          certifications: json.data
            .map((b) => b.badge_template?.name)
            .filter(Boolean),
        };
      }
    } catch {
      /* not JSON — parse as HTML */
    }

    const certifications = [];
    const patterns = [
      /class="[^"]*badge[^"]*title[^"]*"[^>]*>([^<]+)</gi,
      /data-testid="[^"]*badge[^"]*"[^>]*>([^<]+)</gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (name && !certifications.includes(name)) certifications.push(name);
      }
    }
    return { certifications };
  } catch (err) {
    console.error("[credly] fetch error:", err.message);
    return { certifications: [] };
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────
async function runPipeline(application_id, job_id, user_id) {
  console.log(`\n[pipeline] ▶ Starting  ${application_id}`);

  // 1. Read Firestore docs in parallel
  const [candidateSnap, jobSnap] = await Promise.all([
    getDoc(doc(db, "candidates", application_id)),
    getDoc(doc(db, "jobs", job_id)),
  ]);

  if (!candidateSnap.exists() || !jobSnap.exists()) {
    console.error(`[pipeline] ✗ Missing Firestore docs for ${application_id}`);
    return;
  }

  const candidate = candidateSnap.data();
  const job = jobSnap.data();

  // 2. Fetch all external data in parallel (resume_text already in Firestore doc)
  console.log(`[pipeline]   Fetching GitHub / LeetCode / Credly...`);
  const [githubData, leetcodeData, credlyData] = await Promise.all([
    fetchGitHub(candidate.github_username || ""),
    fetchLeetCode(candidate.leetcode_username || ""),
    fetchCredy(candidate.credly_url || ""),
  ]);
  const resumeText = candidate.resume_text || "";

  // 3. Build full structure
  const structure = {
    application_id,
    user_id,
    job_id,
    candidate_name: candidate.candidate_name || "",
    email: candidate.email || "",
    phone: candidate.phone || "",
    company_name: job.company_name || "",
    company_description: job.company_about || "",
    job_title: job.job_title || "",
    job_description: job.job_description || "",
    oa_link: job.oa_link || "",
    resume_file: "",
    resume_text: resumeText,
    github_data: githubData,
    leetcode_data: leetcodeData,
    credly_data: credlyData,
    resume_analysis: { score: 0, strengths: [], weaknesses: [], red_flags: [] },
    github_analysis: { score: 0, strengths: [], weaknesses: [], red_flags: [] },
    leetcode_analysis: { score: 0, strengths: [], weaknesses: [], red_flags: [] },
    credly_analysis: { score: 0, strengths: [], weaknesses: [], red_flags: [] },
    overall_score: 0,
    combined_strengths: [],
    combined_weaknesses: [],
    combined_red_flags: [],
    decision: "",
    reasoning: "",
    confidence: 0,
    email_subject: "",
    email_content: "",
    slack_message: "",
  };

  // 4. Print the structure that would be sent to Airia
  console.log("\n===== STRUCTURE (would be sent to Airia) =====");
  console.log(JSON.stringify(structure, null, 2));
  console.log("===== END STRUCTURE =====\n");

  const airiaConfigured = !!(process.env.AIRIA_PIPELINE_ID && process.env.AIRIA_API_KEY);

  if (!airiaConfigured) {
    // ── TEST MODE ──────────────────────────────────────────────────────────────
    // Save structure as-is (analysis fields empty), keep status as PROCESSING
    console.log(`[pipeline]   [test mode] Writing results doc to Firestore...`);
    await setDoc(doc(db, "results", application_id), {
      ...structure,
      processed_at: new Date(),
      hr_decision: "PENDING",
      hr_decided_at: null,
      hr_id: null,
    });
    // Status stays PROCESSING — Airia hasn't run yet
    console.log(`[pipeline] ✓ Done (test mode — status left as PROCESSING)  ${application_id}`);
    return;
  }

  // ── AIRIA CALL ─────────────────────────────────────────────────────────────
  console.log(`[pipeline]   Sending structure to Airia...`);
  const airiaUrl = `https://api.airia.ai/v2/PipelineExecution/${process.env.AIRIA_PIPELINE_ID}?version=3.00`;
  const airiaRes = await fetch(airiaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": (process.env.AIRIA_API_KEY || "").trim(),
    },
    body: JSON.stringify({ userInput: JSON.stringify(structure), asyncOutput: true, debug: false }),
  });

  if (!airiaRes.ok) {
    const errText = await airiaRes.text().catch(() => "");
    throw new Error(`Airia responded ${airiaRes.status}: ${errText.slice(0, 200)}`);
  }

  // Consume the SSE stream, collecting ModelStreamFragment tokens
  const reader = airiaRes.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let currentAgentContent = "";
  let lastCompleteAgentContent = "";

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const lastNewline = sseBuffer.lastIndexOf("\n");
    if (lastNewline === -1) continue;

    const lines = sseBuffer.slice(0, lastNewline).split("\n");
    sseBuffer = sseBuffer.slice(lastNewline + 1);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      let event;
      try { event = JSON.parse(raw); } catch { continue; }

      if (event.MessageType === "ModelStreamFragment") {
        currentAgentContent += event.Content || "";
      } else if (event.MessageType === "AgentComplete" || event.MessageType === "StepComplete") {
        if (currentAgentContent.trim()) lastCompleteAgentContent = currentAgentContent;
        currentAgentContent = "";
      }
    }
  }

  const rawOutput = lastCompleteAgentContent || currentAgentContent;
  console.log(`[pipeline]   Airia raw output (first 300):`, rawOutput.slice(0, 300));

  // Extract the JSON object from the output (same as test-pipeline.js)
  let enriched = structure;
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      enriched = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn("[pipeline]   Could not parse Airia JSON — using raw structure");
    }
  } else {
    console.warn("[pipeline]   No JSON found in Airia output — using raw structure");
  }

  // 5. Save enriched output to Firestore results (flat, like output.json + HR fields)
  console.log(`[pipeline]   Writing enriched results doc to Firestore...`);
  await setDoc(doc(db, "results", application_id), {
    ...enriched,
    processed_at: new Date(),
    hr_decision: "PENDING",
    hr_decided_at: null,
    hr_id: null,
  });

  // 6. Update candidate status → PROCESSED (Airia has responded) + increment job pending count
  console.log(`[pipeline]   Updating candidate status and job counters...`);
  await Promise.all([
    updateDoc(doc(db, "candidates", application_id), { status: "PENDING" }),
    updateDoc(doc(db, "jobs", job_id), { pending: increment(1) }),
  ]);

  console.log(`[pipeline] ✓ Done  ${application_id}`);
}

// ── Decision agent helpers ───────────────────────────────────────────────────
async function callAiriaAgent(agentId, resultData) {
  const url = `https://api.airia.ai/v2/PipelineExecution/${agentId}?version=3.00`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": (process.env.AIRIA_API_KEY || "").trim(),
    },
    body: JSON.stringify({ userInput: JSON.stringify(resultData), asyncOutput: true, debug: false }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Airia agent responded ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let currentAgentContent = "";
  let lastCompleteAgentContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lastNewline = sseBuffer.lastIndexOf("\n");
    if (lastNewline === -1) continue;
    const lines = sseBuffer.slice(0, lastNewline).split("\n");
    sseBuffer = sseBuffer.slice(lastNewline + 1);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      let event;
      try { event = JSON.parse(raw); } catch { continue; }
      if (event.MessageType === "ModelStreamFragment") {
        currentAgentContent += event.Content || "";
      } else if (event.MessageType === "AgentComplete" || event.MessageType === "StepComplete") {
        if (currentAgentContent.trim()) lastCompleteAgentContent = currentAgentContent;
        currentAgentContent = "";
      }
    }
  }

  return lastCompleteAgentContent || currentAgentContent;
}

async function runDecisionBackground(applicationId, action, hrId) {
  console.log(`\n[decide] ▶ Background processing for ${applicationId} (${action})`);

  const agentId = action === "APPROVED"
    ? process.env.AIRIA_SELECTION_AGENT_ID
    : process.env.AIRIA_REJECTION_AGENT_ID;

  if (!agentId) {
    console.error(`[decide] No agent ID configured for action ${action}`);
    return;
  }

  const resultSnap = await getDoc(doc(db, "results", applicationId));
  if (!resultSnap.exists()) {
    console.error(`[decide] No result doc found for ${applicationId}`);
    return;
  }
  const resultData = resultSnap.data();

  console.log(`[decide]   Calling Airia ${action === "APPROVED" ? "Selection" : "Rejection"} agent...`);
  const rawOutput = await callAiriaAgent(agentId, resultData);
  console.log(`[decide]   Airia agent raw output (first 300):`, rawOutput.slice(0, 300));

  let enriched = {};
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { enriched = JSON.parse(jsonMatch[0]); }
    catch { console.warn(`[decide] Could not parse agent JSON for ${applicationId} — email/slack will be skipped`); }
  } else {
    console.warn(`[decide] No JSON in agent output for ${applicationId} — email/slack will be skipped`);
  }

  const { email_subject = "", email_content = "", slack_message = "" } = enriched;

  function plainToHtml(text) {
    if (!text) return "";
    if (/<[a-z][\s\S]*>/i.test(text)) return text;
    // If agent used double newlines → paragraphs with <br> inside
    // If agent used only single newlines → treat each line as its own paragraph
    const hasDoubleNewline = /\n\n/.test(text);
    const chunks = hasDoubleNewline
      ? text.split(/\n\n+/).map((para) => para.replace(/\n/g, "<br>"))
      : text.split(/\n/).filter((line) => line.trim() !== "");
    return chunks
      .map((chunk) => `<p style="margin:0 0 14px 0;line-height:1.6">${chunk}</p>`)
      .join("");
  }

  const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;font-size:14px;color:#1e293b;max-width:600px;margin:0 auto;padding:32px 24px">
${plainToHtml(email_content)}
</body></html>`;

  await updateDoc(doc(db, "results", applicationId), {
    email_subject,
    email_content,
    slack_message,
  });
  console.log(`[decide]   Updated result doc with email/slack content`);

  // Send email via Resend
  if (email_subject && email_content && process.env.RESEND_API_KEY) {
    const candidateSnap = await getDoc(doc(db, "candidates", applicationId));
    const toEmail = candidateSnap.exists() ? candidateSnap.data().email : null;
    if (toEmail) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
          to: [toEmail],
          subject: email_subject,
          html: emailHtml,
        }),
      });
      if (!emailRes.ok) {
        const t = await emailRes.text().catch(() => "");
        console.error(`[decide] Resend error ${emailRes.status}: ${t.slice(0, 200)}`);
      } else {
        console.log(`[decide] ✓ Email sent to ${toEmail}`);
      }
    }
  }

  // Post to Slack
  if (slack_message && process.env.SLACK_WEBHOOK_URL) {
    const slackRes = await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: slack_message }),
    });
    if (!slackRes.ok) {
      console.error(`[decide] Slack webhook error ${slackRes.status}`);
    } else {
      console.log(`[decide] ✓ Slack message sent`);
    }
  }

  console.log(`[decide] ✓ Done  ${applicationId}`);
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const PORT = process.env.PIPELINE_PORT || 4000;

const server = http.createServer((req, res) => {
  // POST /process  — trigger pipeline for one application
  if (req.method === "POST" && req.url === "/process") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      const { application_id, job_id, user_id } = payload;
      if (!application_id || !job_id) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing required fields: application_id, job_id" }));
        return;
      }

      // Respond immediately — the pipeline runs in background
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true, application_id }));

      // Run pipeline independently
      runPipeline(application_id, job_id, user_id).catch((err) => {
        console.error(`[pipeline] ✗ Error for ${application_id}:`, err.message);
        updateDoc(doc(db, "candidates", application_id), {
          status: "ERROR",
        }).catch(() => {});
      });
    });
    return;
  }

  // POST /decide  — HR approves or rejects a candidate
  if (req.method === "POST" && req.url === "/decide") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      const { applicationId, action, hrId } = payload;
      if (!applicationId || !action || !["APPROVED", "REJECTED"].includes(action)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing or invalid fields: applicationId, action" }));
        return;
      }

      // Synchronously update Firestore status — UI reflects this immediately
      try {
        await Promise.all([
          updateDoc(doc(db, "candidates", applicationId), { status: action }),
          updateDoc(doc(db, "results", applicationId), {
            hr_decision: action,
            hr_decided_at: new Date(),
            hr_id: hrId || null,
          }),
        ]);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }

      // Respond immediately — email + Slack handled in background
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, status: action }));

      runDecisionBackground(applicationId, action, hrId).catch((err) => {
        console.error(`[decide] ✗ Background error for ${applicationId}:`, err.message);
      });
    });
    return;
  }

  // GET /health  — uptime check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   HireIQ Pipeline Server             ║`);
  console.log(`║   http://localhost:${PORT}              ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`Firebase project : ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "(not set)"}`);
  console.log(`Airia pipeline   : ${process.env.AIRIA_PIPELINE_ID ? "✓ configured" : "✗ not set (test mode)"}`);
  console.log(`GitHub token     : ${process.env.GITHUB_TOKEN ? "✓ set" : "✗ not set (may hit rate limits)"}`);
  console.log();
});
