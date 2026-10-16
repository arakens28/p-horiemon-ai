import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectDir = process.env.SALES_ANALYSIS_DIR || path.join(process.env.USERPROFILE || "", "sales-analysis");
const credentialsPath = process.env.SALES_LENS_CREDENTIALS || path.resolve("work", "sync-credentials.json");

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === '"' && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value); value = "";
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const [headers = [], ...data] = rows;
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index]?.trim() || ""])));
}

function field(markdown, label) {
  return markdown.match(new RegExp(`- \\*\\*${label}\\*\\*:\\s*(.+)`))?.[1]?.trim() || "";
}

function section(markdown, heading) {
  const start = markdown.search(new RegExp(`^##\\s+[^\\n]*${heading}[^\\n]*$`, "m"));
  if (start < 0) return "";
  const contentStart = markdown.indexOf("\n", start) + 1;
  const rest = markdown.slice(contentStart);
  const next = rest.search(/^##\s+/m);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

function bullets(text) {
  return [...text.matchAll(/^[-*]\s+(.+)$/gm)].map((match) => match[1].replace(/\*\*/g, "").trim()).filter(Boolean);
}

function reportSummary(markdown, fallback) {
  const summary = section(markdown, "総評");
  const paragraph = summary.split(/\n\s*\n/).map((value) => value.replace(/^#+\s*/gm, "").trim()).find((value) => value && !value.startsWith("**"));
  return paragraph || fallback;
}

function reportMoments(markdown) {
  const process = section(markdown, "話の進め方");
  return [...process.matchAll(/^\d+\.\s+([^–—\n]+)[–—]\s*(.+)$/gm)].slice(0, 10).map((match, index) => ({
    time: match[1].match(/\d{1,2}:\d{2}/)?.[0] || `${index + 1}`,
    label: match[2].replace(/\*\*/g, "").trim(),
    tone: index < 2 ? "good" : index === 2 ? "warn" : "plain",
  }));
}

async function loadReports() {
  const dir = path.join(projectDir, "reports");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".md"));
  const reports = new Map();
  await Promise.all(files.map(async (name) => {
    const markdown = await readFile(path.join(dir, name), "utf8");
    const id = field(markdown, "Notta record_id");
    if (id) reports.set(id.slice(0, 8), { id, markdown });
  }));
  return reports;
}

async function loadRows(filename) {
  return parseCsv(await readFile(path.join(projectDir, "data", filename), "utf8"));
}

function makeMeeting(row, kind, report) {
  const markdown = report.markdown;
  const companyFromReport = field(markdown, "相手企業");
  const contactFromReport = field(markdown, "相手担当");
  const title = field(markdown, "タイトル") || `${row.company} 商談`;
  const confidence = (row.confidence || "C").slice(0, 1);
  const process = section(markdown, "話の進め方");
  const good = bullets(process).slice(0, 2);
  const improve = bullets(section(markdown, "改善")).slice(0, 2);
  return {
    id: report.id,
    recordId: report.id,
    meetingDate: row.date,
    company: row.company && row.company !== "-" ? row.company : companyFromReport || "企業名要確認",
    contact: row.contact && row.contact !== "-" ? row.contact : contactFromReport || "担当者要確認",
    title,
    type: kind === "A" ? "法人研修" : "フランチャイズ",
    confidence: ["A", "B", "C"].includes(confidence) ? confidence : "C",
    status: kind === "A" ? row.hubspot_dealstage || "分析済み" : "分析済み",
    time: row.date,
    duration: field(markdown, "商談時間") || "—",
    summary: reportSummary(markdown, row.notes || "詳細レポートを確認してください。"),
    concern: row.main_concern || "要確認",
    next: row.decision_next_action || "次のアクションを確認",
    owner: "飯泉",
    due: "要確認",
    signal: confidence === "A" ? 88 : confidence === "B" ? 70 : 45,
    good: good.length ? good : ["相手の課題に沿って提案を組み立てた"],
    improve: improve.length ? improve : ["次回の判断条件と期限をより具体化する"],
    moments: reportMoments(markdown),
    reportMarkdown: markdown,
  };
}

async function main() {
  const [credentialsText, reports, rowsA, rowsB] = await Promise.all([
    readFile(credentialsPath, "utf8"),
    loadReports(),
    loadRows("meetings_A.csv"),
    loadRows("meetings_B.csv"),
  ]);
  const credentials = JSON.parse(credentialsText);
  const meetings = [...rowsA.map((row) => [row, "A"]), ...rowsB.map((row) => [row, "B"])]
    .map(([row, kind]) => reports.has(row.record_id) ? makeMeeting(row, kind, reports.get(row.record_id)) : null)
    .filter(Boolean);

  if (!meetings.length) throw new Error("同期できる分析レポートがありません。");
  const response = await fetch(`${credentials.siteUrl.replace(/\/$/, "")}/api/meetings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${credentials.syncSecret}`,
      "OAI-Sites-Authorization": `Bearer ${credentials.siteToken}`,
    },
    body: JSON.stringify({ meetings }),
  });
  if (!response.ok) throw new Error(`同期に失敗しました (${response.status}): ${await response.text()}`);
  const result = await response.json();
  console.log(`Sales Lensへ${result.count}件を同期しました。`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
