import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { cacheKey, normalizeParams, buildPrompt, extractJson, sanitize, corsHeaders } from "./lib/common.mjs";

// バックグラウンド関数(ファイル名が -background で終わると最大15分実行できる)。
// 検索結果は Netlify Blobs に保存し、/api/search-result が取り出す。

const MODEL = process.env.SEARCH_MODEL || "claude-sonnet-4-6";
const MAX_CONTINUATIONS = 3;
const CACHE_DAYS = 7; // 同じ条件の検索結果を使い回す日数

const client = new Anthropic();

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return;
  }
  const params = normalizeParams(body);
  if (!params.pref) return;

  const key = cacheKey(params);
  const store = getStore("search-results");

  // 新しい結果が既にあれば再検索しない(エラー結果は再検索する)
  const existing = await store.get(key, { type: "json" });
  if (existing && !existing.error && existing.searched_at) {
    const ageDays = (Date.now() - new Date(existing.searched_at).getTime()) / 86400000;
    if (ageDays < CACHE_DAYS) return;
  }

  const userQuery = buildPrompt(params);
  // 20260209版(高精度)は3分以上かかるため、高速な20250305版を使用(約30秒)
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
  let messages = [{ role: "user", content: userQuery }];

  try {
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      tools,
      messages,
    });

    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
      messages = [
        { role: "user", content: userQuery },
        { role: "assistant", content: response.content },
      ];
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: "low" },
        tools,
        messages,
      });
      continuations++;
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = extractJson(text);
    if (parsed === null) {
      console.warn("search-local-background: JSONを抽出できませんでした:", text.slice(0, 300));
    }

    await store.setJSON(key, {
      programs: sanitize(parsed || []),
      searched_area: params.city ? `${params.pref}${params.city}` : params.pref,
      searched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("search-local-background error:", err?.status, err?.message);
    await store.setJSON(key, {
      programs: [],
      error: true,
      searched_at: new Date().toISOString(),
    });
  }
};
// AI検索は費用が発生するため、同一利用者からの短時間の連続実行を抑止する。
// background を明示し、旧来のファイル名規則にも依存しない設定にする。
export const config = {
  background: true,
  method: ["POST", "OPTIONS"],
  path: "/api/search-local",
  rateLimit: {
    windowLimit: 5,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};