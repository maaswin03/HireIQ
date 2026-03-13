/**
 * test-decision.mjs
 *
 * End-to-end test for the HR decision flow.
 * Uses output.json as the candidate result payload.
 *
 * Tests:
 *   1. Selection Agent  (APPROVED) — Airia call + parse + print
 *   2. Rejection Agent  (REJECTED) — Airia call + parse + print
 *   3. Resend email     — using the email_content from test 1
 *   4. Slack webhook    — using the slack_message from test 1
 *
 * Run:
 *   node --env-file=.env test-decision.mjs [selection|rejection|resend|slack|all]
 *
 * Default (no arg) runs ALL tests sequentially.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const resultData = JSON.parse(readFileSync(join(__dirname, "output.json"), "utf8"));

const AIRIA_API_KEY      = process.env.AIRIA_API_KEY?.trim();
const SELECTION_AGENT_ID = process.env.AIRIA_SELECTION_AGENT_ID;
const REJECTION_AGENT_ID = process.env.AIRIA_REJECTION_AGENT_ID;
const RESEND_API_KEY     = process.env.RESEND_API_KEY;
const RESEND_FROM        = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const SLACK_WEBHOOK      = process.env.SLACK_WEBHOOK_URL;

const TO_EMAIL = resultData.email;

function plainToHtml(text) {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  const hasDoubleNewline = /\n\n/.test(text);
  const chunks = hasDoubleNewline
    ? text.split(/\n\n+/).map((para) => para.replace(/\n/g, "<br>"))
    : text.split(/\n/).filter((line) => line.trim() !== "");
  return chunks
    .map((chunk) => `<p style="margin:0 0 14px 0;line-height:1.6">${chunk}</p>`)
    .join("");
}

function wrapHtml(body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;font-size:14px;color:#1e293b;max-width:600px;margin:0 auto;padding:32px 24px">
${body}
</body></html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sep(label) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

function pass(msg) { console.log(`  ✓  ${msg}`); }
function fail(msg) { console.error(`  ✗  ${msg}`); }
function info(msg) { console.log(`  →  ${msg}`); }

async function callAiriaAgent(agentId, payload) {
  const url = `https://api.airia.ai/v2/PipelineExecution/${agentId}?version=3.00`;
  info(`POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": AIRIA_API_KEY,
    },
    body: JSON.stringify({ userInput: JSON.stringify(payload), asyncOutput: true, debug: false }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Airia responded ${res.status}: ${errText.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let currentContent = "";
  let lastCompleteContent = "";

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
        currentContent += event.Content || "";
      } else if (event.MessageType === "AgentComplete" || event.MessageType === "StepComplete") {
        if (currentContent.trim()) lastCompleteContent = currentContent;
        currentContent = "";
      }
    }
  }

  return lastCompleteContent || currentContent;
}

function parseAgentOutput(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ── Test 1: Selection Agent ───────────────────────────────────────────────────

async function testSelection() {
  sep("TEST 1 — Selection Agent (APPROVED)");

  if (!SELECTION_AGENT_ID) { fail("AIRIA_SELECTION_AGENT_ID not set in .env"); return null; }
  if (!AIRIA_API_KEY)       { fail("AIRIA_API_KEY not set in .env");             return null; }

  info(`Agent ID : ${SELECTION_AGENT_ID}`);
  info(`Candidate: ${resultData.candidate_name} <${resultData.email}>`);

  const raw = await callAiriaAgent(SELECTION_AGENT_ID, resultData);
  console.log("\n  Raw output (first 500 chars):");
  console.log("  " + raw.slice(0, 500).replace(/\n/g, "\n  "));

  const parsed = parseAgentOutput(raw);
  if (!parsed) { fail("Could not parse JSON from agent output"); return null; }

  console.log("\n  Parsed fields:");
  info(`email_subject  : ${parsed.email_subject || "(empty)"}`);
  info(`slack_message  : ${(parsed.slack_message || "(empty)").slice(0, 120)}...`);
  info(`email_content  :\n  ${ (parsed.email_content || "(empty)").slice(0, 300).replace(/\n/g, "\n  ") }`);

  pass("Selection agent test complete");
  return parsed;
}

// ── Test 2: Rejection Agent ───────────────────────────────────────────────────

async function testRejection() {
  sep("TEST 2 — Rejection Agent (REJECTED)");

  if (!REJECTION_AGENT_ID) { fail("AIRIA_REJECTION_AGENT_ID not set in .env"); return null; }
  if (!AIRIA_API_KEY)       { fail("AIRIA_API_KEY not set in .env");             return null; }

  info(`Agent ID : ${REJECTION_AGENT_ID}`);
  info(`Candidate: ${resultData.candidate_name} <${resultData.email}>`);

  const raw = await callAiriaAgent(REJECTION_AGENT_ID, resultData);
  console.log("\n  Raw output (first 500 chars):");
  console.log("  " + raw.slice(0, 500).replace(/\n/g, "\n  "));

  const parsed = parseAgentOutput(raw);
  if (!parsed) { fail("Could not parse JSON from agent output"); return null; }

  console.log("\n  Parsed fields:");
  info(`email_subject  : ${parsed.email_subject || "(empty)"}`);
  info(`slack_message  : ${(parsed.slack_message || "(empty)").slice(0, 120)}...`);
  info(`email_content  :\n  ${ (parsed.email_content || "(empty)").slice(0, 300).replace(/\n/g, "\n  ") }`);

  pass("Rejection agent test complete");
  return parsed;
}

// ── Test 3: Resend Email ──────────────────────────────────────────────────────

async function testResend(emailSubject, emailContent) {
  sep("TEST 3 — Resend Email");

  if (!RESEND_API_KEY) { fail("RESEND_API_KEY not set in .env"); return; }

  const subject = emailSubject || resultData.email_subject || "HireIQ — Test Email";
  const html    = wrapHtml(plainToHtml(emailContent || resultData.email_content || "<p>This is a HireIQ test email.</p>"));

  info(`From   : ${RESEND_FROM}`);
  info(`To     : ${TO_EMAIL}`);
  info(`Subject: ${subject}`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [TO_EMAIL],
      subject,
      html,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    fail(`Resend error ${res.status}: ${JSON.stringify(body)}`);
    return;
  }

  pass(`Email sent.  id=${body.id}`);
}

// ── Test 4: Slack Webhook ─────────────────────────────────────────────────────

async function testSlack(slackMessage) {
  sep("TEST 4 — Slack Webhook");

  if (!SLACK_WEBHOOK) { fail("SLACK_WEBHOOK_URL not set in .env"); return; }

  const message = slackMessage || resultData.slack_message ||
    `🧪 *HireIQ Test* | Candidate: ${resultData.candidate_name} | Score: ${resultData.overall_score}/100 | This is a test notification.`;

  info(`Webhook : ${SLACK_WEBHOOK.replace(/\/[^/]+$/, "/***")}`);
  info(`Message : ${message.slice(0, 140)}...`);

  const res = await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    fail(`Slack error ${res.status}: ${text}`);
    return;
  }

  pass(`Slack message delivered (status ${res.status}, body: "${text}")`);
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2] || "all";

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║   HireIQ Decision Flow — Test Suite                      ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`  Mode     : ${arg}`);
  console.log(`  Candidate: ${resultData.candidate_name} (${resultData.application_id})`);
  console.log(`  Email    : ${TO_EMAIL}`);

  let selectionResult = null;
  let rejectionResult = null;

  try {
    if (arg === "selection" || arg === "all") {
      selectionResult = await testSelection();
    }

    if (arg === "rejection" || arg === "all") {
      rejectionResult = await testRejection();
    }

    if (arg === "resend" || arg === "all") {
      // Use selection output if available (approval email), else fall back to output.json values
      const sub = selectionResult?.email_subject;
      const html = selectionResult?.email_content;
      await testResend(sub, html);
    }

    if (arg === "slack" || arg === "all") {
      // Use selection output if available, else fall back to output.json values
      const msg = selectionResult?.slack_message;
      await testSlack(msg);
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log("  All requested tests finished.");
    console.log(`${"═".repeat(60)}\n`);
  } catch (err) {
    console.error("\n  FATAL:", err.message);
    process.exit(1);
  }
}

main();
